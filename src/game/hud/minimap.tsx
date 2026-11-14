"use client";

import { useEffect, useRef } from "react";
import { shopColour } from "@/components/town/shop-style";
import type { GameBus } from "../bus";
import { arrowTurn, mapPoint } from "../map-view";
import { WALK_RADIUS, type Spot, type Vec2 } from "../layout";

/** Round map of the town: stalls, the job board, the races, you, and where to go. */
export function Minimap({ bus, spots, closed, goal }: { bus: GameBus; spots: Spot[]; closed: Set<string>; goal: Vec2 | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const s = c.width;
        const k = (s / 2 - 6) / WALK_RADIUS;
        // The map turns with your view: what is ahead of you is up, what is on
        // your right is right. Same as the screen and the stick.
        const P = (p: Vec2) => {
          const m = mapPoint(bus.yaw, p);
          return [s / 2 + m.right * k, s / 2 - m.ahead * k] as const;
        };
        ctx.clearRect(0, 0, s, s);
        ctx.fillStyle = "#9ccf7a";
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#efe2c8";
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 14 * k, 0, Math.PI * 2);
        ctx.fill();
        for (const sp of spots) {
          const [x, y] = P(sp.pos);
          ctx.fillStyle = sp.kind === "shop" ? (closed.has(sp.id) ? "#9a948c" : shopColour(sp.id)) : sp.kind === "fountain" ? "#5cc7e8" : "#8a5a33";
          ctx.beginPath();
          ctx.arc(x, y, sp.kind === "fountain" ? 6 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (goal) {
          const [x, y] = P(goal);
          ctx.strokeStyle = "#ffcf4a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 8 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        const [nx, ny] = P({ x: 0, z: WALK_RADIUS * 0.82 });
        ctx.fillStyle = "#2a1c1f";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N", nx, ny);
        const [px, py] = P(bus.mover.pos);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(arrowTurn(bus.yaw, bus.mover.heading));
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#2a1c1f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bus, spots, closed, goal]);
  return <canvas ref={canvas} width={112} height={112} className="h-24 w-24 rounded-full border-2 border-white/70 shadow-lg md:h-28 md:w-28" aria-label="Town map" role="img" />;
}
