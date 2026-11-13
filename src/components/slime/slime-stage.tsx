"use client";

import { Suspense } from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SlimeModel, type Reaction } from "./slime-model";
import type { SlimeColour, SlimeState } from "./look";

/** Soft studio reflections without downloading an HDR file. */
export function addStudioReflections({ gl, scene }: RootState) {
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

export function StudioLight() {
  return (
    <>
      <hemisphereLight args={["#fff4e6", "#c9a98f", 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff1dc" />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#bcd7ff" />
    </>
  );
}

type Props = {
  state: SlimeState;
  colour: SlimeColour;
  size?: number;
  reaction?: Reaction | null;
  className?: string;
  label?: string;
};

/** One slime in its own small 3D scene with a transparent background. */
export default function SlimeStage({ state, colour, size = 1, reaction, className, label }: Props) {
  return (
    <div className={className} role="img" aria-label={label ?? `A ${colour} slime that looks ${state}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.5, 5.2], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={(root) => {
          root.camera.lookAt(0, 0.85, 0);
          addStudioReflections(root);
        }}
      >
        <StudioLight />
        <Suspense fallback={null}>
          <SlimeModel state={state} colour={colour} size={size} reaction={reaction} />
        </Suspense>
      </Canvas>
    </div>
  );
}
