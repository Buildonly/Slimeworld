"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { bounceHeightAt, COLOUR_STYLES, lookFor, squashStretchAt, type SlimeColour, type SlimeState } from "./look";
import { SlimeFace } from "./slime-face";
import { Sparkles, SweatDrop, Zzz, GroundShadow } from "./slime-effects";

/** Made in Blender by art/blender/make_slime.py, compressed with glTF Transform. */
export const SLIME_MODEL_URL = "/models/slime.glb";

/** Height of the body's middle above the ground in the model. */
const BODY_CENTRE = 0.62;
/** Height of the eyes in the model. */
const EYE_HEIGHT = 0.78;

/** A one-off reaction. Give each new reaction a new `id` to play it. */
export type Reaction = { kind: "hop" | "spin" | "droop"; id: number };

type Props = {
  state: SlimeState;
  colour: SlimeColour;
  /** Grows with age and care: 0.8 (hatchling) to 1.4 (big). */
  size?: number;
  reaction?: Reaction | null;
  /** Offsets the animation so a crowd of slimes does not move in lockstep. */
  seed?: number;
  /** Read each frame: true while the player is moving it, for bigger, quicker hops. */
  movingRef?: { current: boolean };
};

type Wobble = { uTime: { value: number }; uWobble: { value: number } };

/** Copy of the Blender jelly material with a small vertex wobble added to its shader. */
function makeJellyMaterial(source: THREE.Material): THREE.MeshPhysicalMaterial {
  const base = source instanceof THREE.MeshPhysicalMaterial ? source : new THREE.MeshPhysicalMaterial();
  const mat = base.clone();
  // Transmission renders the scene twice; too slow for low-end phones. Clearcoat,
  // sheen and soft translucency keep the jelly look.
  mat.transmission = 0;
  mat.clearcoat = 1;
  mat.clearcoatRoughness = 0.08;
  mat.sheen = 0.5;
  mat.sheenRoughness = 0.4;
  mat.transparent = true;
  const wobble: Wobble = { uTime: { value: 0 }, uWobble: { value: 1 } };
  mat.userData.wobble = wobble;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wobble.uTime;
    shader.uniforms.uWobble = wobble.uWobble;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWobble;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float w = sin(position.y * 4.0 + uTime * 3.1) * 0.018 + sin(position.x * 5.0 + uTime * 2.3) * 0.014
                + sin(position.z * 4.5 + uTime * 2.7) * 0.012;
        transformed += normal * w * uWobble * smoothstep(-0.9, 0.2, position.y);`,
      );
  };
  return mat;
}

function targetColour(hex: string, saturation: number, lighten: number): THREE.Color {
  const c = new THREE.Color(hex);
  if (saturation === 0) return c.set("#a9a9b3");
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * saturation), Math.min(0.92, hsl.l + lighten));
}

export function SlimeModel({ state, colour, size = 1, reaction, seed = 0, movingRef }: Props) {
  const look = lookFor(state);
  const style = COLOUR_STYLES[colour];
  const { nodes } = useGLTF(SLIME_MODEL_URL);

  const bodyMesh = nodes.Body as THREE.Mesh;
  const geometry = bodyMesh.geometry;
  const material = useMemo(() => makeJellyMaterial(bodyMesh.material as THREE.Material), [bodyMesh]);
  const eyes = useMemo(() => (nodes.Eyes as THREE.Object3D).clone(true), [nodes]);
  const target = useMemo(() => targetColour(style.hex, look.saturation, look.lighten), [style.hex, look.saturation, look.lighten]);

  const jump = useRef<THREE.Group>(null);
  const squashGroup = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const eyeGroup = useRef<THREE.Group>(null);
  // Smoothly blend between states rather than snapping.
  const anim = useRef({ ...look, reactionId: -1, reactionAt: 0 });

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + seed * 1.37;
    const k = 1 - Math.exp(-delta * 4);
    const cur = anim.current;
    for (const key of ["widthScale", "heightScale", "bounceHeight", "bounceRate", "squash", "breath", "wobble"] as const) {
      cur[key] += (look[key] - cur[key]) * k;
    }

    const mat = body.current?.material as THREE.MeshPhysicalMaterial | undefined;
    if (mat) {
      mat.color.lerp(target, k);
      mat.opacity += (style.opacity - mat.opacity) * k;
      const wobble = mat.userData.wobble as Wobble;
      wobble.uTime.value = t;
      wobble.uWobble.value = cur.wobble;
    }

    // Bounce with squash and stretch.
    const moving = movingRef?.current === true && !look.sleeping;
    const phase = t * (moving ? Math.max(1.8, cur.bounceRate * 1.6) : cur.bounceRate);
    const height = moving ? Math.max(0.35, cur.bounceHeight) : cur.bounceHeight;
    let hop = bounceHeightAt(phase, height);
    const ss = squashStretchAt(phase, Math.max(cur.squash, moving ? 0.2 : 0) * Math.min(1, height * 6));
    let y = ss.y * (1 + Math.sin(t * 2.2) * cur.breath);
    let xz = ss.xz * (1 - Math.sin(t * 2.2) * cur.breath * 0.5);
    let spin = 0;

    // One-off reactions.
    if (reaction && cur.reactionId !== reaction.id) {
      cur.reactionId = reaction.id;
      cur.reactionAt = clock.elapsedTime;
    }
    const age = clock.elapsedTime - cur.reactionAt;
    if (reaction && age >= 0 && age < 1.2) {
      const p = age / 1.2;
      if (reaction.kind === "hop") {
        hop += bounceHeightAt(Math.min(p * 1.4, 1), 1.1);
        y *= 1 + 0.2 * Math.sin(p * Math.PI * 2);
      } else if (reaction.kind === "spin") {
        spin = easeInOut(p) * Math.PI * 2;
        hop += bounceHeightAt(p, 0.5);
      } else {
        y *= 1 - 0.3 * Math.sin(p * Math.PI);
        xz *= 1 + 0.15 * Math.sin(p * Math.PI);
      }
    }

    // Blink now and then.
    const blink = (clock.elapsedTime + seed) % 4.2 > 4.05 ? 0.12 : 1;
    if (eyeGroup.current) eyeGroup.current.scale.y += (blink - eyeGroup.current.scale.y) * 0.5;

    if (jump.current) {
      jump.current.position.y = hop;
      jump.current.rotation.y = spin + (look.sleeping ? 0 : Math.sin(t * 0.7) * 0.12);
    }
    squashGroup.current?.scale.set(xz * cur.widthScale, y * cur.heightScale, xz * cur.widthScale);
    if (shadow.current) {
      shadow.current.scale.setScalar((1.25 * cur.widthScale) / (1 + hop * 0.8));
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 / (1 + hop * 1.5);
    }
  });

  return (
    <group scale={size}>
      <GroundShadow ref={shadow} />
      <group ref={jump}>
        {/* The model's bottom sits on y = 0, so squash keeps the slime on the floor. */}
        <group ref={squashGroup}>
          {/* Quantised geometry: the node carries the offset and scale. */}
          <mesh
            ref={body}
            geometry={geometry}
            material={material}
            position={bodyMesh.position.toArray()}
            scale={bodyMesh.scale.toArray()}
          />
          {/* Blink by squashing the eye group around the eyes' own height. */}
          <group ref={eyeGroup} position={[0, EYE_HEIGHT, 0]} visible={look.eyes !== "closed"}>
            <primitive object={eyes} position={[look.eyes === "look" ? 0.05 : 0, -EYE_HEIGHT - (look.eyes === "look" ? 0.03 : 0), 0]} />
          </group>
          <group position={[0, BODY_CENTRE, 0]}>
            <SlimeFace look={look} />
          </group>
        </group>
        {(look.sparkles || style.alwaysSparkle) && <Sparkles strong={look.sparkles} />}
        {look.sweat && <SweatDrop />}
        {look.sleeping && <Zzz />}
      </group>
    </group>
  );
}

useGLTF.preload(SLIME_MODEL_URL);

function easeInOut(p: number) {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}
