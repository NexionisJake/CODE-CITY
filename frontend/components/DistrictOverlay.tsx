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
    const map = new Map<string, any[]>();
    buildings.forEach(b => {
      const parts = b.file_path.replace(/\\/g, "/").split("/");
      const key = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : "__root__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [buildings]);

  const patches = useMemo(() => {
    const result: Array<{
      key: string;
      cx: number; cz: number;
      width: number; depth: number;
      color: string;
    }> = [];

    let colorIdx = 0;
    for (const [key, group] of districts.entries()) {
      if (group.length === 0) continue;

      const xs = group.map((b: any) => b.position.x);
      const zs = group.map((b: any) => b.position.z);
      const minX = Math.min(...xs) - 12;
      const maxX = Math.max(...xs) + 12;
      const minZ = Math.min(...zs) - 12;
      const maxZ = Math.max(...zs) + 12;

      result.push({
        key,
        cx: (minX + maxX) / 2,
        cz: (minZ + maxZ) / 2,
        width: maxX - minX,
        depth: maxZ - minZ,
        color: DISTRICT_COLORS[colorIdx % DISTRICT_COLORS.length],
      });
      colorIdx++;
    }
    return result;
  }, [districts]);

  return (
    <>
      {patches.map(patch => (
        <group key={patch.key}>
          {/* Colored ground patch */}
          <mesh
            position={[patch.cx, 0.02, patch.cz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[patch.width, patch.depth]} />
            <meshStandardMaterial
              color={patch.color}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </mesh>

          {/* Subtle border outline */}
          <lineSegments position={[patch.cx, 0.03, patch.cz]}>
            <edgesGeometry
              args={[new THREE.BoxGeometry(patch.width, 0.01, patch.depth)]}
            />
            <lineBasicMaterial color={patch.color} transparent opacity={0.4} />
          </lineSegments>

          {/* Floating district label */}
          <Html
            position={[patch.cx, 2, patch.cz - patch.depth / 2 - 4]}
            center
            style={{ pointerEvents: "none" }}
          >
            <div style={{
              background: `${patch.color}cc`,
              color: "white",
              padding: "3px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}>
              {patch.key}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
