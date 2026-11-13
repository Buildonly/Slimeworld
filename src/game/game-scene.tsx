"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { COLOUR_STYLES, lookFor, type SlimeColour, type SlimeState } from "@/components/slime/look";
import { SlimeModel, SLIME_MODEL_URL, type Reaction } from "@/components/slime/slime-model";
import { addStudioReflections } from "@/components/slime/slime-stage";
import type { ShopDto, TownSlimeDto } from "@/lib/dto";
import { PLAZA_RADIUS, type Prop, type Solid, type Spot, type Vec2 } from "./layout";
import { newMover, step, towards } from "./movement";
import { TownWorld } from "./world";

import { GameBus } from "./bus";

/** Enough slimes to feel busy without crowding the view. */
const MAX_CROWD = 24;

type Me = { colour: SlimeColour; state: SlimeState; size: number; reaction: Reaction | null };

const SPEED_BY_STATE: Record<SlimeState, number> = { thriving: 1.1, fine: 1, hungry: 0.8, broke: 0.65, asleep: 0 };

function Player({ bus, me, spots, solids }: { bus: GameBus; me: Me; spots: Spot[]; solids: Solid[] }) {
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const { camera } = useThree();
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    moving.current = bus.advance(dt, solids, spots, SPEED_BY_STATE[me.state]);
    const { pos, heading } = bus.mover;
    const g = group.current;
    if (g) {
      g.position.set(pos.x, 0, pos.z);
      g.rotation.y = heading;
    }
    // Follow camera: behind and above, at the player's chosen angle and zoom.
    // If a stall or house is in the way, come in closer instead of looking through it.
    let dist = 7.5 * bus.zoom;
    const bx = -Math.sin(bus.yaw);
    const bz = -Math.cos(bus.yaw);
    for (const s of solids) {
      if (s.r < 0.85) continue; // thin posts never block the view enough to matter
      const t = (s.x - pos.x) * bx + (s.z - pos.z) * bz;
      if (t <= 0.5 || t >= dist) continue;
      const off = Math.hypot(pos.x + bx * t - s.x, pos.z + bz * t - s.z);
      if (off < s.r + 0.6) dist = Math.max(2.6, t - s.r - 0.4);
    }
    // When it has to come close, the camera rises and looks down over the obstacle.
    const height = 4.6 * bus.zoom + 0.6 + Math.max(0, 7.5 * bus.zoom - dist) * 0.3;
    const want = new THREE.Vector3(pos.x + bx * dist, height, pos.z + bz * dist);
    camera.position.lerp(want, 1 - Math.exp(-dt * 5));
    camera.lookAt(pos.x, 1.1, pos.z);
  });
  return (
    <group ref={group}>
      <group scale={0.62}>
        <SlimeModel state={me.state} colour={me.colour} size={me.size} reaction={me.reaction} movingRef={moving} />
      </group>
    </group>
  );
}

/** The town's other slimes, hopping about the plaza. No labels: the town speaks for itself. */
function Crowd({ slimes, solids, player }: { slimes: TownSlimeDto[]; solids: Solid[]; player: GameBus | null }) {
  const { nodes } = useGLTF(SLIME_MODEL_URL);
  const body = nodes.Body as THREE.Mesh;
  const eyes = nodes.Eyes as THREE.Object3D;
  const root = useRef<THREE.Group>(null);
  const walkers = useMemo(
    () =>
      slimes.map((s, i) => {
        const a = (i * 2.399) % (Math.PI * 2);
        const r = 3 + ((i * 7) % 70) / 10;
        const look = lookFor(s.state);
        const colour = new THREE.Color(COLOUR_STYLES[s.colour].hex);
        if (look.saturation === 0) colour.set("#a9a9b3");
        else {
          const hsl = { h: 0, s: 0, l: 0 };
          colour.getHSL(hsl);
          colour.setHSL(hsl.h, Math.min(1, hsl.s * look.saturation), Math.min(0.92, hsl.l + look.lighten));
        }
        return {
          s,
          look,
          material: new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.18, clearcoat: 1, sheen: 0.4, transparent: true, opacity: 0.94 }),
          eyes: eyes.clone(true),
          mover: newMover({ x: Math.sin(a) * r, z: Math.cos(a) * r }),
          target: null as Vec2 | null,
          next: i * 0.37,
        };
      }),
    [slimes, eyes],
  );
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    root.current?.children.forEach((child, i) => {
      const w = walkers[i];
      if (!w) return;
      const still = w.look.sleeping || w.s.working;
      if (!still && t > w.next) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * (PLAZA_RADIUS - 4);
        w.target = { x: Math.sin(a) * r, z: Math.cos(a) * r };
        w.next = t + 4 + Math.random() * 7;
      }
      if (!still) {
        // Give the player some room: step aside when they come close.
        const me = player?.mover.pos;
        const avoid: Solid[] = me ? [...solids, { x: me.x, z: me.z, r: 1.1 }] : solids;
        w.mover = step(w.mover, towards(w.mover.pos, w.target), dt, avoid, 0.45 + w.look.bounceRate * 0.3);
      }
      const moving = w.mover.speed > 0.2;
      const phase = (t * (moving ? 2 : 0.8) + i * 0.31) % 1;
      const hop = still ? 0 : (moving ? 0.35 : 0.08) * 4 * phase * (1 - phase);
      const squash = still ? 1 + Math.sin(t * 2 + i) * 0.03 : phase < 0.1 || phase > 0.9 ? 0.85 : 1.05;
      const size = 0.42 * w.s.size;
      child.position.set(w.mover.pos.x, hop, w.mover.pos.z);
      child.rotation.y = w.mover.heading;
      child.scale.set((size * w.look.widthScale) / Math.sqrt(squash), size * w.look.heightScale * squash, (size * w.look.widthScale) / Math.sqrt(squash));
    });
  });
  return (
    <group ref={root}>
      {walkers.map((w) => (
        <group key={w.s.id}>
          <mesh geometry={body.geometry} material={w.material} position={body.position.toArray()} scale={body.scale.toArray()} />
          {!w.look.sleeping && <primitive object={w.eyes} />}
        </group>
      ))}
    </group>
  );
}

/** A soft golden column of light: "go here". */
function Beam({ at }: { at: Vec2 }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffd36b", transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [],
  );
  useFrame(({ clock }) => {
    if (mesh.current) (mesh.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(clock.elapsedTime * 2.4) * 0.1;
  });
  return (
    <mesh ref={mesh} position={[at.x, 4, at.z]} material={material}>
      <cylinderGeometry args={[0.9, 1.3, 8, 24, 1, true]} />
    </mesh>
  );
}

function Sky({ night }: { night: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  useFrame(({ scene }) => {
    if (hemi.current) hemi.current.intensity += ((night ? 0.3 : 0.85) - hemi.current.intensity) * 0.03;
    if (sun.current) sun.current.intensity += ((night ? 0.12 : 1.8) - sun.current.intensity) * 0.03;
    scene.environmentIntensity += ((night ? 0.25 : 1) - scene.environmentIntensity) * 0.03;
    const bg = scene.background as THREE.Color | null;
    if (bg) bg.lerp(new THREE.Color(night ? "#1c2244" : "#bfe3ff"), 0.03);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.lerp(new THREE.Color(night ? "#1c2244" : "#dff0ff"), 0.03);
  });
  return (
    <>
      <color attach="background" args={[night ? "#1c2244" : "#bfe3ff"]} />
      <fog attach="fog" args={[night ? "#1c2244" : "#dff0ff", 28, 70]} />
      <hemisphereLight ref={hemi} args={["#fff1d8", "#6f8f4f", 0.85]} />
      <directionalLight ref={sun} position={[12, 18, 8]} intensity={1.8} color="#ffe9c8" />
      {night && <pointLight position={[0, 3, 0]} intensity={20} distance={16} color="#ffb860" />}
    </>
  );
}

/** No player (visitors, fast forward): the camera drifts slowly around the town. */
function SpectatorCamera() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * 0.05;
    camera.position.set(Math.sin(a) * 24, 13, Math.cos(a) * 24);
    camera.lookAt(0, 1, 0);
  });
  return null;
}

/** Click or tap the ground to hop there (a drag is for looking around, not moving). */
function GroundInput({ bus }: { bus: GameBus }) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      visible={false}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const d = down.current;
        down.current = null;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) bus.setTarget({ x: e.point.x, z: e.point.z });
      }}
    >
      <circleGeometry args={[40, 32]} />
    </mesh>
  );
}

export type GameSceneProps = {
  bus: GameBus;
  shops: ShopDto[];
  slimes: TownSlimeDto[];
  me: Me | null;
  layout: { spots: Spot[]; solids: Solid[]; props: Prop[] };
  hour: number;
  beam: Vec2 | null;
};

/** The town in 3D, with you in it. */
export default function GameScene({ bus, shops, slimes, me, layout, hour, beam }: GameSceneProps) {
  const night = hour >= 20 || hour < 6;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 6, 14], fov: 50, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={addStudioReflections}
    >
      <Sky night={night} />
      <Suspense fallback={null}>
        <TownWorld shops={shops} spots={layout.spots} props={layout.props} night={night} />
        <Crowd slimes={slimes.slice(0, MAX_CROWD)} solids={layout.solids} player={me ? bus : null} />
        {me ? <Player bus={bus} me={me} spots={layout.spots} solids={layout.solids} /> : <SpectatorCamera />}
        {beam && <Beam at={beam} />}
        {me && <GroundInput bus={bus} />}
      </Suspense>
    </Canvas>
  );
}
