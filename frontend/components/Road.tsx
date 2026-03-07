"use client";
import * as THREE from "three";
import RoadPulse from "./RoadPulse";

const ROAD_HEIGHT = 0.15;
const MAX_ROAD_LENGTH = 300;

interface Props {
  road: any;
  startBuilding: any;
  endBuilding: any;
  simplified?: boolean;
  animated?: boolean;
  nightMode?: boolean;
}

export default function Road({ road, startBuilding, endBuilding, simplified, animated, nightMode = false }: Props) {
  if (!startBuilding || !endBuilding) return null;

  // Building centers
  const sx_c = startBuilding.position.x;
  const sz_c = startBuilding.position.z;
  const ex_c = endBuilding.position.x;
  const ez_c = endBuilding.position.z;

  const dx_raw = ex_c - sx_c;
  const dz_raw = ez_c - sz_c;
  const dist = Math.sqrt(dx_raw * dx_raw + dz_raw * dz_raw);
  if (dist < 0.5) return null;

  // Unit direction vector
  const ux = dx_raw / dist;
  const uz = dz_raw / dist;

  // Offset from building center to its edge
  const startR = Math.max(startBuilding.dimensions.width, startBuilding.dimensions.depth) / 2;
  const endR = Math.max(endBuilding.dimensions.width, endBuilding.dimensions.depth) / 2;

  const sx = sx_c + ux * startR;
  const sz = sz_c + uz * startR;
  const ex = ex_c - ux * endR;
  const ez = ez_c - uz * endR;

  const dx = ex - sx;
  const dz = ez - sz;
  const totalLength = Math.sqrt(dx * dx + dz * dz);
  if (totalLength < 1.0) return null;

  const baseAngle = Math.atan2(dx, dz);
  const mx = (sx + ex) / 2;
  const mz = (sz + ez) / 2;

  // Long cross-cluster roads: render as faint thin line
  if (totalLength > MAX_ROAD_LENGTH && simplified) {
    return (
      <mesh
        position={[mx, 0.06, mz]}
        rotation={[0, baseAngle, 0]}
      >
        <boxGeometry args={[0.4, 0.08, totalLength]} />
        <meshStandardMaterial
          color="#aaaaaa"
          transparent
          opacity={0.3}
          emissive={nightMode ? "#cc9933" : "#000000"}
          emissiveIntensity={nightMode ? 1.5 : 0.3}
        />
      </mesh>
    );
  }

  const isCrossDistrict = road.cross_district === true;

  // For cross-district roads: raise Y position and use golden color
  const roadY = isCrossDistrict ? 3.0 : 0.08;
  const roadColor = isCrossDistrict ? "#cc9933" : (road.directed ? "#6699bb" : "#999990");
  const roadWidth = isCrossDistrict ? 1.8 : (road.directed ? 1.2 : 0.8);
  const roadOpacity = isCrossDistrict ? 0.9 : 0.75;

  // Simplified: flat colored box (fast, readable at scale)
  if (simplified || totalLength < 1.5) {
    return (
      <group>
        <mesh
          position={[mx, roadY, mz]}
          rotation={[0, baseAngle, 0]}
        >
          <boxGeometry args={[roadWidth, isCrossDistrict ? 0.3 : ROAD_HEIGHT, totalLength]} />
          <meshStandardMaterial
            color={roadColor}
            roughness={0.6}
            metalness={isCrossDistrict ? 0.4 : 0.0}
            transparent
            opacity={roadOpacity}
            emissive={isCrossDistrict ? "#cc9933" : "#000000"}
            emissiveIntensity={isCrossDistrict ? 0.3 : 0.0}
          />
        </mesh>

        {isCrossDistrict && totalLength > 20 && (
          <>
            {Array.from({ length: Math.floor(totalLength / 40) }, (_, i) => {
              const t = (i + 1) / (Math.floor(totalLength / 40) + 1);
              return (
                <mesh key={i} position={[sx + dx * t, roadY / 2, sz + dz * t]}>
                  <cylinderGeometry args={[0.3, 0.3, roadY, 6]} />
                  <meshStandardMaterial color="#886622" metalness={0.5} roughness={0.4} />
                </mesh>
              );
            })}
          </>
        )}
        {road.directed && animated && totalLength > 5 && (
          <RoadPulse
            start={[sx, roadY, sz]}
            end={[ex, roadY, ez]}
            color="#00ccff"
            speed={0.12}
            offset={((startBuilding.position.x + endBuilding.position.z) % 100) / 100}
            nightMode={nightMode}
          />
        )}
      </group>
    );
  }

  // Full detail: wider road with entrance pads and direction arrow
  return (
    <group>
      <mesh
        position={[mx, roadY, mz]}
        rotation={[0, baseAngle, 0]}
      >
        <boxGeometry args={[1.8, isCrossDistrict ? 0.3 : ROAD_HEIGHT, totalLength]} />
        <meshStandardMaterial
          color={roadColor}
          roughness={0.6}
          metalness={isCrossDistrict ? 0.4 : 0.0}
          transparent
          opacity={roadOpacity}
          emissive={isCrossDistrict ? "#cc9933" : "#000000"}
          emissiveIntensity={isCrossDistrict ? 0.3 : 0.0}
        />
      </mesh>

      {/* Support pillars for cross-district detailed roads */}
      {isCrossDistrict && totalLength > 20 && (
        <>
          {Array.from({ length: Math.floor(totalLength / 40) }, (_, i) => {
            const t = (i + 1) / (Math.floor(totalLength / 40) + 1);
            return (
              <mesh key={i} position={[sx + dx * t, roadY / 2, sz + dz * t]}>
                <cylinderGeometry args={[0.3, 0.3, roadY, 6]} />
                <meshStandardMaterial color="#886622" metalness={0.5} roughness={0.4} />
              </mesh>
            );
          })}
        </>
      )}

      {/* Entrance pads at building bases */}
      {totalLength > 3 && (
        <>
          <mesh position={[sx, roadY, sz]}>
            <boxGeometry args={[2.5, isCrossDistrict ? 0.3 : ROAD_HEIGHT, 2.5]} />
            <meshStandardMaterial color={roadColor} roughness={0.95} />
          </mesh>
          <mesh position={[ex, roadY, ez]}>
            <boxGeometry args={[2.5, isCrossDistrict ? 0.3 : ROAD_HEIGHT, 2.5]} />
            <meshStandardMaterial color={roadColor} roughness={0.95} />
          </mesh>
        </>
      )}

      {/* Direction arrow at midpoint */}
      {road.directed && (
        <mesh
          position={[mx, roadY + 0.4, mz]}
          rotation={[-Math.PI / 2, 0, -baseAngle]}
        >
          <coneGeometry args={[0.4, 1.0, 5]} />
          <meshStandardMaterial
            color="#00ccff"
            emissive="#00ccff"
            emissiveIntensity={nightMode ? 2.0 : 0.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {road.directed && animated && totalLength > 5 && (
        <RoadPulse
          start={[sx, roadY, sz]}
          end={[ex, roadY, ez]}
          color="#00ccff"
          speed={0.12}
          offset={((startBuilding.position.x + endBuilding.position.z) % 100) / 100}
          nightMode={nightMode}
        />
      )}
    </group>
  );
}
