"use client";

import { useEffect } from "react";
import type { GameBus } from "./bus";

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [1, 0], ArrowLeft: [1, 0], KeyD: [-1, 0], ArrowRight: [-1, 0],
};

/**
 * Keyboard: WASD or arrows to hop, E or Enter to use what's nearby.
 * Drag anywhere on the world to look around; wheel to zoom.
 */
export function useControls(bus: GameBus, el: React.RefObject<HTMLElement | null>, onUse: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const held = new Set<string>();
    const apply = () => {
      let x = 0;
      let z = 0;
      for (const k of held) {
        const v = KEYS[k];
        if (v) {
          x += v[0];
          z += v[1];
        }
      }
      const len = Math.hypot(x, z) || 1;
      bus.setInput(x / len, z / len);
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (KEYS[e.code]) {
        held.add(e.code);
        apply();
        e.preventDefault();
      } else if (e.code === "KeyE" || e.code === "Enter") onUse();
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) apply();
    };
    const blur = () => {
      held.clear();
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [bus, onUse, enabled]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let last: number | null = null;
    const pd = (e: PointerEvent) => {
      last = e.clientX;
    };
    const pm = (e: PointerEvent) => {
      if (last === null || (e.pointerType === "mouse" && e.buttons === 0)) return;
      bus.look(-(e.clientX - last) * 0.006);
      last = e.clientX;
    };
    const pu = () => {
      last = null;
    };
    const wheel = (e: WheelEvent) => bus.look(0, e.deltaY * 0.001);
    node.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    node.addEventListener("wheel", wheel, { passive: true });
    return () => {
      node.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      node.removeEventListener("wheel", wheel);
    };
  }, [bus, el]);
}
