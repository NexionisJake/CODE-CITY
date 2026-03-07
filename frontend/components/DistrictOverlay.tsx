"use client";
import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";

// Distinct muted colors for up to 12 districts
const DISTRICT_COLORS = [
  "#4466aa", "#aa4444", "#44aa66", "#aaaa44",
  "#aa6644", "#6644aa", "#44aaaa", "#aa44aa",
  "#668844", "#884466", "#446688", "#888844",
];

interface Props {
  buildings: any[];
}

export default function DistrictOverlay({ buildings }: Props) {
  // Group buildings by their cluster key (top-level directory)
  const districts = useMemo(() => {
    const map = new Map<string, {
      rect: { x: number; z: number; w: number; d: number };
      color: { r: number; g: number; b: number };
      label: string;
    }>();

    buildings.forEach(b => {
      if (b.district && b.district_meta && !map.has(b.district)) {
        map.set(b.district, b.district_meta);
      }
    });

    return Array.from(map.values());
  }, [buildings]);

  return (
    <>
      {districts.map((d, i) => {
        const { rect, color, label } = d;
        const cx = rect.x + rect.w / 2;
        const cz = rect.z + rect.d / 2;
        const hexColor = `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;

        return (
          <group key={label}>
            {/* Ground patch */}
            <mesh position={[cx, 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[rect.w, rect.d]} />
              <meshStandardMaterial color={hexColor} transparent opacity={0.10} depthWrite={false} />
            </mesh>

            {/* Subtle border outline */}
            <lineSegments position={[cx, 0.05, cz]}>
              <edgesGeometry args={[new THREE.BoxGeometry(rect.w, 0.01, rect.d)]} />
              <lineBasicMaterial color={hexColor} transparent opacity={0.5} />
            </lineSegments>

            {/* Floating label — positioned at top-center of district, elevated high enough to clear buildings */}
            <Html
              position={[cx, 8, cz]}   // center of district, elevated 8 units
              center
              style={{ pointerEvents: "none" }}
              occlude={false}
            >
              <div style={{
                background: `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.9)`,
                color: "white",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: "bold",
                fontFamily: "monospace",
                whiteSpace: "nowrap",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.2)",
                // Truncate long names
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                📁 {label.length > 14 ? label.slice(0, 13) + "…" : label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
