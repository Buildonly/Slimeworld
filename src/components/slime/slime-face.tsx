"use client";

import * as THREE from "three";
import type { SlimeLook } from "./look";

// The eyes themselves come from the Blender model. The face adds what
// changes with mood: closed lids, grumpy brows, the mouth and blush.

const INK = new THREE.MeshBasicMaterial({ color: "#2a1c1f" });
const MOUTH = new THREE.MeshBasicMaterial({ color: "#7a2e3b" });
const TONGUE = new THREE.MeshBasicMaterial({ color: "#ff8e9e" });
const BLUSH = new THREE.MeshBasicMaterial({ color: "#ff7fa0", transparent: true, opacity: 0.45, depthWrite: false });

const arcGeo = new THREE.TorusGeometry(0.1, 0.022, 8, 24, Math.PI);
const lidGeo = new THREE.TorusGeometry(0.09, 0.022, 8, 20, Math.PI);
const grinGeo = new THREE.CircleGeometry(0.15, 24, Math.PI, Math.PI);
const tongueGeo = new THREE.CircleGeometry(0.07, 16, Math.PI, Math.PI);
const barGeo = new THREE.CapsuleGeometry(0.018, 0.13, 4, 8);
const ringGeo = new THREE.TorusGeometry(0.045, 0.018, 8, 20);
const blushGeo = new THREE.CircleGeometry(0.09, 20);

const EYE_X = 0.32;
const EYE_Y = 0.16;

/** Mood parts of the face, placed on the front of the body around its centre. */
export function SlimeFace({ look }: { look: SlimeLook }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * EYE_X, EYE_Y, 0.93]} rotation={[0, side * 0.3, 0]}>
          {look.eyes === "closed" && <mesh geometry={lidGeo} material={INK} rotation={[0, 0, Math.PI]} />}
          {look.eyes === "grumpy" && (
            <mesh geometry={barGeo} material={INK} position={[0, 0.2, 0.02]} rotation={[0, 0, Math.PI / 2 + side * 0.35]} />
          )}
        </group>
      ))}

      <group position={[0, -0.1, 0.99]}>
        {look.mouth === "grin" && (
          <>
            <mesh geometry={grinGeo} material={MOUTH} position={[0, 0.03, 0]} />
            <mesh geometry={tongueGeo} material={TONGUE} position={[0, -0.04, 0.002]} />
          </>
        )}
        {look.mouth === "smile" && <mesh geometry={arcGeo} material={INK} rotation={[0, 0, Math.PI]} position={[0, 0.06, 0]} />}
        {look.mouth === "frown" && <mesh geometry={arcGeo} material={INK} position={[0, -0.04, 0]} scale={[0.9, 0.7, 1]} />}
        {look.mouth === "flat" && <mesh geometry={barGeo} material={INK} rotation={[0, 0, Math.PI / 2]} />}
        {look.mouth === "sleep" && <mesh geometry={ringGeo} material={INK} />}
      </group>

      {look.blush &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            geometry={blushGeo}
            material={BLUSH}
            position={[side * 0.55, -0.02, 0.82]}
            rotation={[0, side * 0.6, 0]}
            scale={[1.2, 0.75, 1]}
          />
        ))}
    </group>
  );
}
