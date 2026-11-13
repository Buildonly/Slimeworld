"use client";

import { useRef, useState } from "react";
import type { GameBus } from "../bus";

/** Thumb stick for phones and tablets. Push to hop that way. */
export function Joystick({ bus }: { bus: GameBus }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 46;
  const move = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let x = e.clientX - (rect.left + rect.width / 2);
    let y = e.clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(x, y);
    if (d > R) {
      x = (x / d) * R;
      y = (y / d) * R;
    }
    setKnob({ x, y });
    bus.setInput(-x / R, -y / R);
  };
  const end = () => {
    setKnob({ x: 0, y: 0 });
    bus.setInput(0, 0);
  };
  return (
    <div
      ref={base}
      aria-label="Move your slime"
      role="application"
      className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border-2 border-white/40 bg-black/20 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.buttons && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/80 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
