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
  cameraDistance?: number;  // distance from scene center
}

export default function DistrictOverlay({ buildings, cameraDistance = 200 }: Props) {
  // Group buildings by their cluster key (top-level directory)
  const districts = useMemo(() => {
    const map = new Map<string, {
      rect: { x: number; z: number; w: number; d: number };
      color: { r: number; g: number; b: number };
      label: string;
      key: string;
    }>();

    buildings.forEach(b => {
      if (b.district && b.district_meta && !map.has(b.district)) {
        map.set(b.district, { ...b.district_meta, key: b.district });
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
        const fileCount = buildings.filter(b => b.district === d.key).length;

        const getLabelScale = (distance: number) => {
          if (distance > 1200) return 0;       // hide only when extremely far away
          if (distance > 600) return 0.5;      // extra small
          if (distance > 300) return 0.7;      // small
          if (distance > 150) return 0.9;      // normal
          if (distance > 50) return 1.1;       // larger
          return 1.3;                           // maximum zoomed in
        };

        const labelScale = getLabelScale(cameraDistance);
        const showSubtext = cameraDistance < 400; // show file counts up to a larger distance

        // Y position varies per district to reduce overlap
        const labelY = 8 + (i % 3) * 4;  // 8, 12, or 16

        return (
          <group key={label}>
            {/* Ground patch */}
            <mesh position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[rect.w, rect.d]} />
              <meshStandardMaterial color={hexColor} transparent opacity={0.18} depthWrite={false} />
            </mesh>

            {/* District border outline */}
            <lineSegments position={[cx, 0.08, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(rect.w, rect.d)]} />
              <lineBasicMaterial color={hexColor} transparent opacity={0.25} />
            </lineSegments>

            {/* Floating label */}
            {labelScale > 0 && (
              <Html
                position={[cx, labelY, cz]}
                center
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  transition: "opacity 0.3s, transform 0.3s",
                  opacity: labelScale,
                  transform: `scale(${labelScale})`,
                }}
              >
                <div
                  style={{
                    background: `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.22)`,
                    border: `1px solid rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.44)`,
                    borderRadius: 6,
                    padding: "3px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{
                    color: hexColor,
                    fontSize: 11 * labelScale,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                  }}>
                    {label}
                  </div>
                  {showSubtext && (
                    <div style={{
                      color: `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0.99)`,
                      fontSize: 9,
                      textAlign: "center",
                      marginTop: 1,
                    }}>
                      {fileCount} file{fileCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}
