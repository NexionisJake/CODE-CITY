"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  building: any;
  nightMode?: boolean;
}

export default function ComplexityHalo({ building, nightMode = false }: Props) {
  const { position, dimensions, color, metadata } = building;
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const threeColor = useMemo(
    () => new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
    [color.r, color.g, color.b]
  );

  // Ring size based on building footprint
  const outerRadius = Math.max(dimensions.width, dimensions.depth) / 2 + 2.0;
  const ringThickness = metadata.is_hotspot ? 2.0 : 1.0;
  const innerRadius = outerRadius - ringThickness;

  // Pulse hotspot rings
  useFrame(({ clock }) => {
    if (matRef.current && metadata.is_hotspot) {
      matRef.current.emissiveIntensity =
        1.2 + Math.sin(clock.getElapsedTime() * 2.5) * 0.8;
    }
  });

  const baseIntensity = nightMode
    ? Math.min(2.0 + metadata.complexity / 8, 5.0)
    : Math.min(0.8 + metadata.complexity / 15, 2.5);
  const baseOpacity = nightMode
    ? Math.min(0.7 + metadata.complexity / 20, 0.95)
    : Math.min(0.35 + metadata.complexity / 40, 0.7);

  return (
    <>
      {/* Dark backing ring for contrast against light ground */}
      <mesh
        position={[position.x, 0.04, position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[innerRadius - 0.3, outerRadius + 0.3, 48]} />
        <meshStandardMaterial
          color="#222222"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* Colored complexity ring */}
      <mesh
        position={[position.x, 0.06, position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[innerRadius, outerRadius, 48]} />
        <meshStandardMaterial
          ref={matRef}
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={baseIntensity}
          transparent
          opacity={baseOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
