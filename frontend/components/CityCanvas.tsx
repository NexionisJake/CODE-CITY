"use client";
import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import Building from "./Building";
import Road from "./Road";
import BuildingTooltip from "./BuildingTooltip";
import ComplexityHalo from "./ComplexityHalo";
import DistrictOverlay from "./DistrictOverlay";
import Minimap from "./Minimap";

export default function CityCanvas({ data }: { data: any }) {
  const [selected, setSelected] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cameraTarget, setCameraTarget] = useState({ x: 0, z: 0 });
  const controlsRef = useRef<any>(null);

  const buildingMap = useMemo(() => {
    const map: Record<string, any> = {};
    data.buildings.forEach((b: any) => { map[b.id] = b; });
    return map;
  }, [data.buildings]);

  // Search: compute highlighted IDs
  const highlightedIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set<string>(
      data.buildings
        .filter((b: any) => {
          const fp = (b.file_path || "").toLowerCase();
          const lang = (b.metadata?.language || "").toLowerCase();
          const summary = (b.metadata?.ai_summary || "").toLowerCase();
          return fp.includes(q) || lang.includes(q) || summary.includes(q);
        })
        .map((b: any) => b.id)
    );
  }, [searchQuery, data.buildings]);

  const hasSearch = searchQuery.trim().length > 0;

  // Fly camera to first match
  useEffect(() => {
    if (highlightedIds.size === 0 || !controlsRef.current) return;
    const firstId = highlightedIds.values().next().value;
    const b = buildingMap[firstId];
    if (!b) return;
    const target = controlsRef.current.target;
    target.set(b.position.x, 0, b.position.z);
    controlsRef.current.update();
  }, [highlightedIds, buildingMap]);

  // With many connections, always use simplified flat-box roads
  const simplified = data.roads.length > 80;

  // Calculate city bounds for camera positioning
  const cityBounds = useMemo(() => {
    if (!data.buildings.length) return { width: 200, depth: 200, centerX: 0, centerZ: 0 };
    const xs = data.buildings.map((b: any) => b.position.x);
    const zs = data.buildings.map((b: any) => b.position.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    return {
      width: maxX - minX,
      depth: maxZ - minZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
    };
  }, [data.buildings]);

  // More aggressive zoom-out for large cities
  const camDistance = Math.max(cityBounds.width, cityBounds.depth) * 1.2 + 100;
  const camHeight = camDistance * 0.65;
  const camX = cityBounds.centerX;
  const camZ = cityBounds.centerZ + camDistance;

  return (
    <>
      <Canvas
        shadows
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        camera={{ position: [camX, camHeight, camZ], fov: 55, near: 1, far: 8000 }}
        style={{ background: "#b8d4e8" }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight
          position={[150, 250, 150]}
          intensity={2.0}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={600}
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />
        <hemisphereLight args={["#c9e8ff", "#a8c890", 0.6]} />

        {/* Ground plane */}
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[5000, 5000]} />
          <meshStandardMaterial color="#b0b0a8" roughness={0.95} />
        </mesh>

        {/* Subtle city block grid */}
        <Grid
          args={[5000, 5000]}
          cellSize={2}
          cellThickness={0.4}
          cellColor="#b0b0a8"
          sectionSize={20}
          sectionThickness={0.8}
          sectionColor="#a0a098"
          position={[0, 0.01, 0]}
          fadeDistance={600}
          infiniteGrid
        />

        {/* District ground patches and labels */}
        <DistrictOverlay buildings={data.buildings} />

        {/* Complexity halos under every building */}
        {data.buildings.map((b: any) => (
          <ComplexityHalo key={`halo-${b.id}`} building={b} />
        ))}

        {/* Kenney building models */}
        <Suspense fallback={null}>
          {data.buildings.map((b: any) => (
            <Building
              key={b.id}
              building={b}
              onClick={() => setSelected(b)}
              highlighted={highlightedIds.has(b.id)}
              dimmed={hasSearch && !highlightedIds.has(b.id)}
            />
          ))}
        </Suspense>

        {/* Road connections */}
        {data.roads.map((r: any, i: number) => (
          <Road
            key={i}
            road={r}
            startBuilding={buildingMap[r.start_building_id]}
            endBuilding={buildingMap[r.end_building_id]}
            simplified={simplified}
          />
        ))}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[cityBounds.centerX, 0, cityBounds.centerZ]}
          minDistance={20}
          maxDistance={camDistance * 5}
          maxPolarAngle={Math.PI / 2.1}
          onChange={() => {
            if (controlsRef.current) {
              const t = controlsRef.current.target;
              setCameraTarget({ x: t.x, z: t.z });
            }
          }}
        />
      </Canvas>

      {/* Search overlay */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="bg-gray-900/80 backdrop-blur text-white text-sm rounded-lg pl-3 pr-8 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 w-64"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg leading-none"
            >
              &times;
            </button>
          )}
        </div>
        {hasSearch && (
          <span className="text-sm text-gray-300 bg-gray-900/80 backdrop-blur border border-gray-800 rounded-lg px-3 py-2">
            {highlightedIds.size} match{highlightedIds.size !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Minimap */}
      <Minimap
        buildings={data.buildings}
        cameraTarget={cameraTarget}
      />

      {/* HTML overlay — outside Canvas */}
      {selected && (
        <BuildingTooltip
          building={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
