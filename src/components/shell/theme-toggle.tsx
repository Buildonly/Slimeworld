"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

function isDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr ? attr === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** Switch light/dark; remembers the choice. Defaults to the system setting. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => null);
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full bg-bg-soft text-ink"
      onClick={() => {
        const next = !isDark();
        document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
