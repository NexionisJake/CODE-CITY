"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { getArchetype, pickModel, MODEL_NATIVE_HEIGHTS } from "@/lib/buildingRegistry";

interface Props {
  building: any;
  onClick: () => void;
  highlighted?: boolean;
  dimmed?: boolean;
  nightMode?: boolean;
  revealDelay?: number; // ms before the rise animation begins
}

export default function Building({ building, onClick, highlighted, dimmed, nightMode = false, revealDelay = 0 }: Props) {
  const { file_path, position, dimensions, color, metadata } = building;
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const revealRef = useRef({ delayLeft: revealDelay / 1000, progress: 0 });

  const archetype = getArchetype(metadata.loc);
  const modelPath = pickModel(archetype, file_path);

  // Load and clone the GLB
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    // Apply complexity-based emissive tint to all meshes in the model
    const tintColor = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
    const baseIntensity = nightMode
      ? Math.min(metadata.complexity / 20, 0.4)
      : Math.min(metadata.complexity / 50, 0.08);

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = (child.material as THREE.MeshStandardMaterial).clone();
        mat.emissive = tintColor;
        mat.emissiveIntensity = baseIntensity;
        child.material = mat;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, color, metadata.complexity, nightMode]);

  // Hover / highlight / dim effect
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (highlighted) {
          mat.emissive = new THREE.Color(1, 0.9, 0.3);
          mat.emissiveIntensity = 0.6;
        } else if (hovered) {
          mat.emissive = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
          mat.emissiveIntensity = 0.35;
        } else {
          mat.emissive = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
          mat.emissiveIntensity = Math.min(metadata.complexity / 50, 0.08);
        }
        mat.opacity = dimmed ? 0.25 : 1.0;
        mat.transparent = dimmed ? true : false;
        mat.needsUpdate = true;
      }
    });
  }, [hovered, highlighted, dimmed, clonedScene, metadata.complexity, color]);

  // Auto-measure the model's bounding box height to get correct scale
  const measuredScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const nativeHeight = size.y > 0 ? size.y : MODEL_NATIVE_HEIGHTS[archetype];
    const targetHeight = dimensions.height;
    return targetHeight / nativeHeight;
  }, [scene, archetype, dimensions.height]);

  // Auto-measure Y offset to sit model on the ground
  // (some Kenney models have their origin at center, not base)
  const groundOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    // If the model's min Y is not at 0, offset to bring it to ground level
    return -box.min.y * measuredScale;
  }, [scene, measuredScale]);

  // Rise-from-ground reveal animation
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const r = revealRef.current;
    if (r.progress >= 1) return;

    if (r.delayLeft > 0) {
      r.delayLeft -= delta;
      return;
    }

    r.progress = Math.min(r.progress + delta * 2.5, 1); // ~0.4s per building
    const t = r.progress;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const startY = groundOffset - dimensions.height * 1.5;
    groupRef.current.position.y = startY + (groundOffset - startY) * eased;
  });

  // Initialise below ground before first frame
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.y = groundOffset - dimensions.height * 1.5;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group
      ref={groupRef}
      position-x={position.x}
      position-z={position.z}
      scale={[measuredScale, measuredScale, measuredScale]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <primitive object={clonedScene} />

      {/* Floating name label on hover */}
      {hovered && (
        <Html
          position={[0, (dimensions.height / measuredScale) + 1, 0]}
          center
          occlude
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            background: "rgba(10,10,20,0.92)",
            color: "white",
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}>
            {file_path.split("/").pop()}
            {(metadata.language || metadata.loc) && (
              <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>
                {[
                  metadata.language,
                  metadata.loc != null ? `${metadata.loc} LOC` : null,
                ].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Preload all building models at startup to avoid pop-in
import { BUILDING_MODELS } from "@/lib/buildingRegistry";
Object.values(BUILDING_MODELS).flat().forEach(path => useGLTF.preload(path));
