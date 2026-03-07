"use client";

import { useMemo } from "react";

interface WindowGridProps {
  width: number;
  height: number;
  depth: number;
  floors: number;
  windowsPerFloor: number;
  faceOffset: number;
  rotation: [number, number, number];
  position: [number, number, number];
  windowColor?: string;
  emissiveMin?: number;
  emissiveMax?: number;
  nightMode?: boolean;
}

const WIN_W = 0.4;
const WIN_H = 0.5;
const WIN_D = 0.05;

export default function WindowGrid({
  width,
  height,
  floors,
  windowsPerFloor,
  faceOffset,
  rotation,
  position,
  windowColor = "#ffdd88",
  emissiveMin = 0.6,
  emissiveMax = 1.0,
  nightMode = false,
}: WindowGridProps) {
  // Generate stable lit/dark pattern + per-window intensity once
  const windows = useMemo(() => {
    const result: { row: number; col: number; lit: boolean; intensity: number }[] = [];
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < windowsPerFloor; c++) {
        const lit = Math.random() < 0.85;
        const intensity = lit
          ? emissiveMin + Math.random() * (emissiveMax - emissiveMin)
          : 0;
        result.push({ row: r, col: c, lit, intensity });
      }
    }
    return result;
  }, [floors, windowsPerFloor, emissiveMin, emissiveMax]);

  // Compute spacing so windows are evenly distributed across the face
  const spacingX = width / (windowsPerFloor + 1);
  const spacingY = height / (floors + 1);

  return (
    <group position={position} rotation={rotation}>
      {windows.map((w, i) => {
        const wx = -width / 2 + spacingX * (w.col + 1);
        const wy = -height / 2 + spacingY * (w.row + 1);
        return (
          <mesh key={i} position={[wx, wy, faceOffset]}>
            <boxGeometry args={[WIN_W, WIN_H, WIN_D]} />
            <meshStandardMaterial
              color={w.lit ? (nightMode ? "#ffffaa" : windowColor) : "#111111"}
              emissive={w.lit ? (nightMode ? "#ffff44" : windowColor) : "#000000"}
              emissiveIntensity={w.lit ? (nightMode ? w.intensity * 1.8 : w.intensity) : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}
