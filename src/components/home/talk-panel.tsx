"use client";

import { Mic, Send, Square } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { post } from "@/lib/use-poll";

type Reply = { ok: boolean; say?: string; audio?: string | null; pitch?: number; verified?: boolean | null; error?: string };
type Line = { who: "you" | "slime"; text: string; verified?: boolean | null };

// Browser speech recognition is not in the TypeScript DOM types yet.
type Recognition = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Talk to your slime by voice or text. It answers in its own voice, from its real mood. */
export function TalkPanel({ slimeId, name, onReply }: { slimeId: string; name: string; onReply: (say: string) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);

  async function send(said: string) {
    const words = said.trim();
    if (!words) return;
    setText("");
    setLines((l) => [...l.slice(-5), { who: "you", text: words }]);
    setState("thinking");
    const r = await post<Reply>("/api/talk", { slimeId, text: words });
    setState("idle");
    if (!r.ok || !r.say) return toast(r.error ?? `${name} didn't hear you.`, "error");
    setLines((l) => [...l.slice(-5), { who: "slime", text: r.say!, verified: r.verified }]);
    onReply(r.say);
    if (r.audio) {
      const audio = new Audio(r.audio);
      audio.preservesPitch = false; // young slimes squeak
      audio.playbackRate = r.pitch ?? 1.2;
      void audio.play().catch(() => undefined);
    }
  }

  async function listen() {
    if (state === "listening") {
      recognition.current?.stop();
      recorder.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (Ctor) {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.onresult = (e) => void send(e.results[0]?.[0]?.transcript ?? "");
      rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
      rec.onerror = () => {
        setState("idle");
        toast("I couldn't hear that. Try typing?", "error");
      };
      recognition.current = rec;
      setState("listening");
      rec.start();
      return;
    }
    // No built-in recognition: record a short clip and let Whisper on NEAR AI listen.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("thinking");
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType }), "speech.webm");
        const res = await fetch("/api/listen", { method: "POST", body: form });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !json.text) {
          setState("idle");
          return toast(json.error ?? "I couldn't hear that.", "error");
        }
        await send(json.text);
      };
      recorder.current = rec;
      setState("listening");
      rec.start();
      setTimeout(() => rec.state === "recording" && rec.stop(), 6000);
    } catch {
      toast("No microphone? You can type instead.", "error");
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-card p-3">
      {lines.length > 0 && (
        <ul className="mb-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto" aria-live="polite">
          {lines.map((l, i) => (
            <li key={i} className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${l.who === "you" ? "self-end bg-accent/15" : "self-start bg-bg-soft"}`}>
              {l.text}
              {l.who === "slime" && l.verified && <span className="ml-1 text-xs text-accent">✓</span>}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <button
          type="button"
          onClick={listen}
          aria-label={state === "listening" ? "Stop listening" : `Talk to ${name}`}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${state === "listening" ? "animate-pulse bg-danger text-white" : "bg-accent text-accent-ink"}`}
        >
          {state === "listening" ? <Square size={18} /> : <Mic size={20} />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder={state === "thinking" ? `${name} is thinking…` : `Say something to ${name}`}
          aria-label={`Message to ${name}`}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-3 py-2.5"
        />
        <button type="submit" aria-label="Send" disabled={!text.trim() || state === "thinking"} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-soft disabled:opacity-40">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
