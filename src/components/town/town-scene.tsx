"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { COLOUR_STYLES, lookFor } from "@/components/slime/look";
import { addStudioReflections } from "@/components/slime/slime-stage";
import { SLIME_MODEL_URL } from "@/components/slime/slime-model";
import type { ShopDto, TownSlimeDto } from "@/lib/dto";
import { SHOP_EMOJI, shopColour } from "./shop-style";

export const TOWN_MODEL_URL = "/models/town.glb";
const RING = 7.2;

type Props = {
  shops: ShopDto[];
  slimes: TownSlimeDto[];
  hour: number;
  selected: string | null;
  onSelect: (shopId: string) => void;
};

function isNight(hour: number) {
  return hour >= 20 || hour < 6;
}

/** Clone a kit piece so each copy can have its own materials. */
function useKit() {
  const { nodes } = useGLTF(TOWN_MODEL_URL);
  return nodes as Record<string, THREE.Object3D>;
}

function Stall({ shop, angle, selected, onSelect }: { shop: ShopDto; angle: number; selected: boolean; onSelect: () => void }) {
  const kit = useKit();
  const closed = shop.status === "closed";
  const object = useMemo(() => {
    const stall = kit.Stall!.clone(true);
    const awning = new THREE.Color(closed ? "#9a948c" : shopColour(shop.id));
    stall.traverse((o) => {
      if (o.name === "Boards") o.visible = closed;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (m.name === "AwningA") m.color = awning;
        if (closed && m.name.startsWith("Goods")) mesh.visible = false;
        mesh.material = m;
      }
    });
    return stall;
  }, [kit, closed, shop.id]);
  const x = Math.cos(angle) * RING;
  const z = Math.sin(angle) * RING;
  return (
    <group position={[x, 0, z]} rotation={[0, -angle - Math.PI / 2, 0]} onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}>
      <primitive object={object} />
      <Html position={[0, 3.6, 0]} center distanceFactor={12} zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={onSelect}
          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-md ${selected ? "bg-ink text-bg" : "bg-card text-ink"}`}
        >
          {SHOP_EMOJI[shop.id] ?? "🏪"} {shop.name}
          <span className={`ml-2 rounded-full px-2 text-xs ${closed ? "bg-danger/20 text-danger" : shop.status === "busy" ? "bg-coin/30" : "bg-accent/20 text-accent"}`}>
            {closed ? "closed" : shop.status}
          </span>
        </button>
      </Html>
    </group>
  );
}

function TownProps({ count, night }: { count: number; night: boolean }) {
  const kit = useKit();
  const pieces = useMemo(() => {
    const out: { key: string; obj: THREE.Object3D; pos: [number, number, number]; rot: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) / count) * Math.PI * 2;
      out.push({ key: `l${i}`, obj: kit.Lantern!.clone(true), pos: [Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6], rot: 0 });
      out.push({ key: `t${i}`, obj: kit.Tree!.clone(true), pos: [Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5], rot: a });
      const b = a + 0.25;
      out.push({ key: `c${i}`, obj: (i % 2 ? kit.Barrel! : kit.Crate!).clone(true), pos: [Math.cos(b) * 9.4, 0, Math.sin(b) * 9.4], rot: a * 3 });
      if (i % 2 === 0) out.push({ key: `b${i}`, obj: kit.Bench!.clone(true), pos: [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], rot: -a + Math.PI / 2 });
    }
    return out;
  }, [kit, count]);
  // Lanterns share one glow material; brighten it at night.
  const glow = useRef<THREE.MeshStandardMaterial | null>(null);
  useFrame(() => {
    if (!glow.current) {
      for (const p of pieces)
        p.obj.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m?.name === "LanternGlow") glow.current = m;
        });
    }
    const g = glow.current;
    if (g) g.emissiveIntensity += ((night ? 6 : 0.6) - g.emissiveIntensity) * 0.05;
  });
  return (
    <>
      <primitive object={kit.Ground!} />
      <primitive object={kit.Fountain!} />
      {pieces.map((p) => (
        <primitive key={p.key} object={p.obj} position={p.pos} rotation={[0, p.rot, 0]} />
      ))}
    </>
  );
}

/** Slimes milling about the plaza. Cheap: shared geometry, simple hops, no physics. */
function Crowd({ slimes }: { slimes: TownSlimeDto[] }) {
  const { nodes } = useGLTF(SLIME_MODEL_URL);
  const body = nodes.Body as THREE.Mesh;
  const group = useRef<THREE.Group>(null);
  const walkers = useMemo(
    () =>
      slimes.map((s, i) => {
        const a = (i * 2.399) % (Math.PI * 2);
        const r = 3.6 + ((i * 7) % 30) / 10;
        const look = lookFor(s.state);
        const colour = new THREE.Color(COLOUR_STYLES[s.colour].hex);
        if (look.saturation === 0) colour.set("#a9a9b3");
        else {
          const hsl = { h: 0, s: 0, l: 0 };
          colour.getHSL(hsl);
          colour.setHSL(hsl.h, Math.min(1, hsl.s * look.saturation), Math.min(0.92, hsl.l + look.lighten));
        }
        const material = new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.18, clearcoat: 1, sheen: 0.4, transparent: true, opacity: 0.94 });
        return { s, look, material, pos: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), target: new THREE.Vector3(), seed: i * 1.7, next: 0 };
      }),
    [slimes],
  );
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      const w = walkers[i];
      if (!w) return;
      const still = w.look.sleeping || w.s.working;
      if (!still && t > w.next) {
        const a = Math.random() * Math.PI * 2;
        const r = 3.4 + Math.random() * 3.4;
        w.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        w.next = t + 3 + Math.random() * 6;
      }
      if (!still) {
        const dir = w.target.clone().sub(w.pos);
        const dist = dir.length();
        if (dist > 0.1) w.pos.add(dir.multiplyScalar(Math.min(1, (dt * (0.5 + w.look.bounceRate)) / dist)));
        child.rotation.y = Math.atan2(w.target.x - w.pos.x, w.target.z - w.pos.z);
      }
      const phase = (t * Math.max(0.6, w.look.bounceRate * 1.5) + w.seed) % 1;
      const hop = still ? 0 : 0.35 * Math.max(0.15, w.look.bounceHeight * 2) * 4 * phase * (1 - phase);
      const squash = still ? 1 + Math.sin(t * 2 + w.seed) * 0.03 : phase < 0.1 || phase > 0.9 ? 0.85 : 1.05;
      const size = 0.5 * w.s.size;
      child.position.set(w.pos.x, hop, w.pos.z);
      child.scale.set(size * w.look.widthScale / Math.sqrt(squash), size * w.look.heightScale * squash, size * w.look.widthScale / Math.sqrt(squash));
    });
  });
  return (
    <group ref={group}>
      {walkers.map((w) => (
        <group key={w.s.id}>
          <mesh geometry={body.geometry} material={w.material} position={body.position.toArray()} scale={body.scale.toArray()} />
          {w.s.mine && (
            <Html position={[0, 3.4, 0]} center distanceFactor={12} zIndexRange={[30, 0]}>
              <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink shadow">★ {w.s.name}</span>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

function Lights({ night }: { night: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (hemi.current) hemi.current.intensity += ((night ? 0.35 : 1.0) - hemi.current.intensity) * 0.05;
    if (sun.current) sun.current.intensity += ((night ? 0.15 : 1.7) - sun.current.intensity) * 0.05;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#fff4e0", "#b58f6a", 1]} />
      <directionalLight ref={sun} position={[8, 14, 6]} intensity={1.7} color="#ffe9c8" />
      {night && <pointLight position={[0, 3, 0]} intensity={18} distance={14} color="#ffb860" />}
    </>
  );
}

/** The market town in 3D: Blender-made stalls around the fountain, slimes milling about. */
export default function TownScene({ shops, slimes, hour, selected, onSelect }: Props) {
  const night = isNight(hour);
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 13, 17], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={addStudioReflections}
    >
      <Lights night={night} />
      <Suspense fallback={null}>
        <TownProps count={Math.max(6, shops.length)} night={night} />
        {shops.map((shop, i) => (
          <Stall key={shop.id} shop={shop} angle={(i / shops.length) * Math.PI * 2 + 0.3} selected={selected === shop.id} onSelect={() => onSelect(shop.id)} />
        ))}
        <Crowd slimes={slimes} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={30}
        minPolarAngle={0.35}
        maxPolarAngle={1.25}
        autoRotate
        autoRotateSpeed={0.35}
        enableDamping
        target={[0, 1, 0]}
      />
    </Canvas>
  );
}

useGLTF.preload(TOWN_MODEL_URL);
