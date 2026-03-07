"use client";
import { useState, useMemo } from "react";

interface Props {
  buildings: any[];
  cameraTarget: { x: number; z: number };
  onNavigate?: (worldX: number, worldZ: number) => void;
}

const MAP_SIZE = 180; // px
const PADDING = 10;  // px

export default function Minimap({ buildings, cameraTarget, onNavigate }: Props) {
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
      className="city-panel absolute bottom-6 right-6 z-20 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden"
      style={{ width: MAP_SIZE + 20 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-gray-800/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="text-gray-400 text-xs font-medium flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.6">
            <rect x="1" y="4" width="3" height="7" rx="0.5" />
            <rect x="5" y="2" width="3" height="9" rx="0.5" />
            <rect x="9" y="3" width="2" height="8" rx="0.5" />
          </svg>
          Map
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.5"
          className={`text-gray-600 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        >
          <path d="M2 4.5L6 8l4-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          <svg
            width={MAP_SIZE}
            height={MAP_SIZE}
            style={{ display: "block", cursor: onNavigate ? "crosshair" : "default" }}
            onClick={(e) => {
              if (!onNavigate) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const mapX = e.clientX - rect.left;
              const mapY = e.clientY - rect.top;
              // Convert map coords back to world coords
              const worldX = bounds.minX + (mapX - PADDING) / (MAP_SIZE - PADDING * 2) * (bounds.maxX - bounds.minX);
              const worldZ = bounds.minZ + (mapY - PADDING) / (MAP_SIZE - PADDING * 2) * (bounds.maxZ - bounds.minZ);
              onNavigate(worldX, worldZ);
            }}
          >
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

            {/* Viewport indicator */}
            {(() => {
              const viewSize = 80; // world units visible — approximate
              const vx = toMapX(cameraTarget.x - viewSize / 2);
              const vz = toMapZ(cameraTarget.z - viewSize / 2);
              const vw = (viewSize / (bounds.maxX - bounds.minX)) * (MAP_SIZE - PADDING * 2);
              const vh = (viewSize / (bounds.maxZ - bounds.minZ)) * (MAP_SIZE - PADDING * 2);
              return (
                <rect
                  x={Math.max(0, vx)} y={Math.max(0, vz)}
                  width={Math.min(vw, MAP_SIZE)} height={Math.min(vh, MAP_SIZE)}
                  fill="none" stroke="white" strokeWidth={1}
                  strokeDasharray="3 2" opacity={0.3}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}

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
            {buildings.length} buildings · click to navigate
          </p>
        </div>
      )}
    </div>
  );
}
