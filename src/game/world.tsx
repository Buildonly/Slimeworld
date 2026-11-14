"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { shopColour } from "@/components/town/shop-style";
import type { ShopDto } from "@/lib/dto";
import { Billboard } from "@react-three/drei";
import { PLAZA_RADIUS, WALK_RADIUS, type Label, type Path, type Prop, type Spot } from "./layout";

export const TOWN_MODEL_URL = "/models/town.glb";
const ROOF_TINTS = ["#d65c45", "#3f8f8a", "#c98a3a", "#7b5aa6"];

type Kit = Record<string, THREE.Object3D>;

function useKit(): Kit {
  return useGLTF(TOWN_MODEL_URL).nodes as Kit;
}

/** Deep clone with its own materials, optionally recolouring named materials. */
function cloneWith(src: THREE.Object3D, colours: Record<string, string> = {}, hide: (name: string) => boolean = () => false): THREE.Object3D {
  const obj = src.clone(true);
  obj.traverse((o) => {
    if (hide(o.name)) o.visible = false;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = (mesh.material as THREE.MeshStandardMaterial).clone();
    const c = colours[m.name];
    if (c) m.color = new THREE.Color(c);
    mesh.material = m;
  });
  return obj;
}

/** A wooden signboard with painted letters: part of the stall, not an overlay. */
function signTexture(text: string, closed: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 150;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = closed ? "#b9b0a2" : "#f3e3bd";
    ctx.fillRect(0, 0, 512, 150);
    ctx.fillStyle = closed ? "#6d655c" : "#4a2e1c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 64;
    do {
      ctx.font = `700 ${size}px ui-rounded, "Fredoka", system-ui, sans-serif`;
      size -= 4;
    } while (ctx.measureText(text).width > 470 && size > 24);
    ctx.fillText(text, 256, closed ? 60 : 78);
    if (closed) {
      ctx.font = `700 34px ui-rounded, system-ui, sans-serif`;
      ctx.fillStyle = "#a8463c";
      ctx.fillText("CLOSED", 256, 118);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Wide, friendly sign text for the floating place names. */
function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(255,250,240,0.94)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 624, 144, 72);
    ctx.fill();
    ctx.fillStyle = "#3b2a1e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 76px ui-rounded, "Fredoka", system-ui, sans-serif`;
    ctx.fillText(text, 320, 86);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A place name floating over it, always turned toward the camera. */
function FloatingLabel({ label }: { label: Label }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: labelTexture(label.text), transparent: true, depthWrite: false }), [label.text]);
  return (
    <Billboard position={[label.pos.x, label.height, label.pos.z]}>
      <mesh material={mat} renderOrder={5}>
        <planeGeometry args={[3, 0.75]} />
      </mesh>
    </Billboard>
  );
}

/** Stone paths from the square out to each district. */
function PathStrip({ path }: { path: Path }) {
  const dx = path.to.x - path.from.x;
  const dz = path.to.z - path.from.z;
  const len = Math.hypot(dx, dz);
  return (
    <mesh position={[(path.from.x + path.to.x) / 2, 0.02, (path.from.z + path.to.z) / 2]} rotation={[-Math.PI / 2, 0, Math.atan2(dx, dz)]} receiveShadow>
      <planeGeometry args={[path.width, len]} />
      <meshStandardMaterial color="#cdb48b" roughness={1} />
    </mesh>
  );
}

function Stall({ kit, shop, spot }: { kit: Kit; shop: ShopDto; spot: Spot }) {
  const closed = shop.status === "closed";
  const object = useMemo(
    () => cloneWith(kit.Stall!, { AwningA: closed ? "#9a948c" : shopColour(shop.id) }, (n) => n === "Boards" ? !closed : closed && n.startsWith("Goods")),
    [kit, closed, shop.id],
  );
  const sign = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture(shop.name, closed) }), [shop.name, closed]);
  return (
    <group position={[spot.pos.x, 0, spot.pos.z]} rotation={[0, spot.facing, 0]}>
      <primitive object={object} />
      <mesh position={[0, 2.75, 0.47]} material={sign}>
        <planeGeometry args={[1.3, 0.38]} />
      </mesh>
    </group>
  );
}

function PropPiece({ kit, prop }: { kit: Kit; prop: Prop }) {
  const object = useMemo(() => {
    const src = kit[prop.kind];
    if (!src) return null;
    return cloneWith(src, prop.kind === "House" ? { RoofA: ROOF_TINTS[(prop.tint ?? 0) % ROOF_TINTS.length]! } : {});
  }, [kit, prop.kind, prop.tint]);
  if (!object) return null;
  const scale = prop.kind === "Tree" ? 1.5 : prop.kind === "House" ? 1.25 : 1;
  return <primitive object={object} position={[prop.pos.x, 0, prop.pos.z]} rotation={[0, prop.rot, 0]} scale={scale} />;
}

/** Lantern and window glow follows the town clock. */
function NightGlow({ root, night }: { root: React.RefObject<THREE.Group | null>; night: boolean }) {
  const mats = useRef<THREE.MeshStandardMaterial[] | null>(null);
  useFrame(() => {
    if (!root.current) return;
    if (!mats.current) {
      const found: THREE.MeshStandardMaterial[] = [];
      root.current.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && (m.name === "LanternGlow" || m.name === "WindowGlow")) found.push(m);
      });
      if (found.length) mats.current = found;
    }
    for (const m of mats.current ?? []) m.emissiveIntensity += ((night ? 5 : 0.4) - m.emissiveIntensity) * 0.04;
  });
  return null;
}

export function TownWorld({ shops, spots, props, paths, labels, night }: { shops: ShopDto[]; spots: Spot[]; props: Prop[]; paths: Path[]; labels: Label[]; night: boolean }) {
  const kit = useKit();
  const root = useRef<THREE.Group>(null);
  const fixed = useMemo(() => {
    const jobs = spots.find((s) => s.kind === "jobs");
    const races = spots.find((s) => s.kind === "races");
    return {
      // The square keeps its cobbles; the wider town gets simple, calm ground.
      fountain: kit.Fountain!.clone(true),
      board: jobs ? { obj: kit.JobBoard!.clone(true), spot: jobs } : null,
      arch: races ? { obj: kit.RaceArch!.clone(true), spot: races } : null,
    };
  }, [kit, spots]);

  return (
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <circleGeometry args={[120, 48]} />
        <meshStandardMaterial color="#8fcf6a" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <circleGeometry args={[WALK_RADIUS + 1, 64]} />
        <meshStandardMaterial color="#a9d97f" roughness={1} />
      </mesh>
      {/* The Town Square: one calm stone circle, no scattered tiles. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
        <circleGeometry args={[PLAZA_RADIUS, 64]} />
        <meshStandardMaterial color="#e3cfa6" roughness={1} />
      </mesh>
      {paths.map((p, i) => (
        <PathStrip key={i} path={p} />
      ))}
      {labels.map((l) => (
        <FloatingLabel key={l.text} label={l} />
      ))}
      <primitive object={fixed.fountain} />
      {fixed.board && <primitive object={fixed.board.obj} position={[fixed.board.spot.pos.x, 0, fixed.board.spot.pos.z]} rotation={[0, fixed.board.spot.facing, 0]} />}
      {fixed.arch && <primitive object={fixed.arch.obj} position={[fixed.arch.spot.pos.x, 0, fixed.arch.spot.pos.z]} rotation={[0, fixed.arch.spot.facing, 0]} />}
      {shops.map((shop) => {
        const spot = spots.find((s) => s.id === shop.id);
        return spot ? <Stall key={shop.id} kit={kit} shop={shop} spot={spot} /> : null;
      })}
      {props.map((p, i) => (
        <PropPiece key={i} kit={kit} prop={p} />
      ))}
      <NightGlow root={root} night={night} />
    </group>
  );
}

useGLTF.preload(TOWN_MODEL_URL);
