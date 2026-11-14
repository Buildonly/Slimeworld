"use client";

import { useEffect } from "react";
import type { GameBus } from "./bus";

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [1, 0], ArrowLeft: [1, 0], KeyD: [-1, 0], ArrowRight: [-1, 0],
};

/**
 * Keyboard: WASD or arrows to hop, E or Enter to use what's nearby.
 * Drag anywhere on the world to look around: sideways turns, up and down
 * tilts. Pinch with two fingers, or use the wheel, to zoom.
 */
export function useControls(bus: GameBus, el: React.RefObject<HTMLElement | null>, onUse: () => void, enabled: boolean, mounted: boolean) {
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
    // Every finger (or the mouse) on the world, by pointer id.
    const points = new Map<number, { x: number; y: number }>();
    let pinch: number | null = null;
    const spread = () => {
      const [a, b] = [...points.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
    };
    const pd = (e: PointerEvent) => {
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch = points.size === 2 ? spread() : null;
    };
    const pm = (e: PointerEvent) => {
      const p = points.get(e.pointerId);
      if (!p || (e.pointerType === "mouse" && e.buttons === 0)) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size >= 2) {
        const now = spread();
        if (pinch !== null && now !== null) bus.look(0, (pinch - now) * 0.004);
        pinch = now;
      } else {
        bus.look(-dx * 0.006, 0, dy * 0.004);
      }
    };
    const pu = (e: PointerEvent) => {
      points.delete(e.pointerId);
      pinch = points.size === 2 ? spread() : null;
    };
    const wheel = (e: WheelEvent) => bus.look(0, e.deltaY * 0.001);
    node.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    window.addEventListener("pointercancel", pu);
    node.addEventListener("wheel", wheel, { passive: true });
    return () => {
      node.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      window.removeEventListener("pointercancel", pu);
      node.removeEventListener("wheel", wheel);
    };
    // `mounted`: the world element appears only after loading, so attach then.
  }, [bus, el, mounted]);
}
