"use client";

import { useMemo, useRef, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let shadowTex: THREE.Texture | null = null;
let starTex: THREE.Texture | null = null;
let zTex: THREE.Texture | null = null;

/** Soft round shadow under the slime. */
export function GroundShadow({ ref }: { ref?: Ref<THREE.Mesh> }) {
  const material = useMemo(() => {
    shadowTex ??= canvasTexture(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(40,20,30,0.9)");
      g.addColorStop(1, "rgba(40,20,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    return new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.35 });
  }, []);
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Little twinkling stars around a thriving (or crystal) slime. */
export function Sparkles({ strong }: { strong: boolean }) {
  const group = useRef<THREE.Group>(null);
  const count = strong ? 7 : 4;
  const material = useMemo(() => {
    starTex ??= canvasTexture(64, (ctx, s) => {
      ctx.translate(s / 2, s / 2);
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? s * 0.48 : s * 0.12;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
    });
    return new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false });
  }, []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2, s: 0.6 + (i % 3) * 0.3 })), [count]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      const seed = seeds[i];
      if (!seed) return;
      const a = seed.a + t * 0.4;
      const pulse = (Math.sin(t * 3 * seed.s + i) + 1) / 2;
      child.position.set(Math.cos(a) * 1.25, 0.7 + Math.sin(t * seed.s + i) * 0.5 + i * 0.08, Math.sin(a) * 1.25);
      child.scale.setScalar(0.08 + pulse * 0.14);
      ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.3 + pulse * 0.7;
    });
  });

  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <sprite key={i} material={material.clone()} />
      ))}
    </group>
  );
}

/** A worried sweat drop sliding down a broke slime. */
export function SweatDrop() {
  const drop = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!drop.current) return;
    const p = (clock.elapsedTime * 0.5) % 1;
    drop.current.position.set(0.72, 1.05 - p * 0.35, 0.45);
    drop.current.scale.setScalar(p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15);
  });
  return (
    <group ref={drop}>
      <mesh scale={[0.07, 0.09, 0.07]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshPhysicalMaterial color="#a8dcff" roughness={0.05} clearcoat={1} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.1, 0]} scale={[0.07, 0.09, 0.07]}>
        <coneGeometry args={[0.9, 1.2, 16]} />
        <meshPhysicalMaterial color="#a8dcff" roughness={0.05} clearcoat={1} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Floating "z"s over a sleeping slime. */
export function Zzz() {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => {
    zTex ??= canvasTexture(64, (ctx, s) => {
      ctx.fillStyle = "#8f8aa8";
      ctx.font = `bold ${s * 0.8}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("z", s / 2, s / 2);
    });
    return new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false });
  }, []);

  useFrame(({ clock }) => {
    group.current?.children.forEach((child, i) => {
      const p = (clock.elapsedTime * 0.35 + i / 3) % 1;
      child.position.set(0.45 + p * 0.5 + Math.sin(p * 6) * 0.08, 0.9 + p * 1.1, 0.3);
      child.scale.setScalar(0.18 + p * 0.22);
      ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI);
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <sprite key={i} material={material.clone()} />
      ))}
    </group>
  );
}
