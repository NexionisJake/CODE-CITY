"use client";
import { useState, useMemo } from "react";

interface Props {
  buildings: any[];
  cameraTarget: { x: number; z: number };
}

const MAP_SIZE = 180; // px
const PADDING  = 10;  // px

export default function Minimap({ buildings, cameraTarget }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Calculate city bounds
  const bounds = useMemo(() => {
    if (!buildings.length) return { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
    const xs = buildings.map(b => b.position.x);
    const zs = buildings.map(b => b.position.z);
    return {
      minX: Math.min(...xs) - 20,
      maxX: Math.max(...xs) + 20,
      minZ: Math.min(...zs) - 20,
      maxZ: Math.max(...zs) + 20,
    };
  }, [buildings]);

  const toMapX = (worldX: number) =>
    PADDING + ((worldX - bounds.minX) / (bounds.maxX - bounds.minX)) * (MAP_SIZE - PADDING * 2);

  const toMapZ = (worldZ: number) =>
    PADDING + ((worldZ - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * (MAP_SIZE - PADDING * 2);

  const camX = toMapX(cameraTarget.x);
  const camZ = toMapZ(cameraTarget.z);

  return (
    <div
      className="absolute bottom-6 left-6 z-20 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden"
      style={{ width: MAP_SIZE + 20 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="text-gray-400 text-xs font-medium">Map</span>
        <span className="text-gray-600 text-xs">{collapsed ? "▲" : "▼"}</span>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          <svg width={MAP_SIZE} height={MAP_SIZE} style={{ display: "block" }}>
            {/* Background */}
            <rect width={MAP_SIZE} height={MAP_SIZE} fill="#0a0a14" rx={4} />

            {/* Building dots */}
            {buildings.map(b => {
              const x = toMapX(b.position.x);
              const z = toMapZ(b.position.z);
              const r = Math.max(2, Math.min(5, b.dimensions.width / 4));
              const fill = `rgb(${b.color.r},${b.color.g},${b.color.b})`;
              return (
                <circle
                  key={b.id}
                  cx={x}
                  cy={z}
                  r={r}
                  fill={fill}
                  opacity={0.85}
                />
              );
            })}

            {/* Camera crosshair */}
            <line
              x1={camX - 6} y1={camZ}
              x2={camX + 6} y2={camZ}
              stroke="white" strokeWidth={1.5} opacity={0.9}
            />
            <line
              x1={camX} y1={camZ - 6}
              x2={camX} y2={camZ + 6}
              stroke="white" strokeWidth={1.5} opacity={0.9}
            />
            <circle cx={camX} cy={camZ} r={3} fill="none" stroke="white" strokeWidth={1} opacity={0.7} />
          </svg>

          <p className="text-gray-600 text-xs mt-1 text-center">
            {buildings.length} buildings
          </p>
        </div>
      )}
    </div>
  );
}
