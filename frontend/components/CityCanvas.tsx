"use client";
import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import Building from "./Building";
import Road from "./Road";
import BuildingTooltip from "./BuildingTooltip";
import ComplexityHalo from "./ComplexityHalo";
import SocialHalo from "./SocialHalo";
import DistrictOverlay from "./DistrictOverlay";
import Minimap from "./Minimap";
import SherpaMode from "./SherpaMode";
import AskTheCity from "./AskTheCity";

interface Props {
  data: any;
  nightMode?: boolean;
}

/** Smoothly lerps lights between day and night every frame */
function DynamicLights({ nightMode }: { nightMode: boolean }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const pointRef = useRef<THREE.PointLight>(null);
  const lerpRef = useRef(0);

  const daySky = useMemo(() => new THREE.Color("#c9e8ff"), []);
  const dayGround = useMemo(() => new THREE.Color("#a8c890"), []);
  const nightSky = useMemo(() => new THREE.Color("#0a0a2a"), []);
  const nightGround = useMemo(() => new THREE.Color("#000005"), []);
  const dayAmbient = useMemo(() => new THREE.Color("#ffffff"), []);
  const nightAmbient = useMemo(() => new THREE.Color("#0a0a1a"), []);
  const dayDirect = useMemo(() => new THREE.Color("#ffffff"), []);
  const nightDirect = useMemo(() => new THREE.Color("#220011"), []);

  useFrame((_, delta) => {
    const target = nightMode ? 1 : 0;
    lerpRef.current = THREE.MathUtils.lerp(lerpRef.current, target, delta * 1.5);
    const t = lerpRef.current;

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(1.4, 0.04, t);
      ambientRef.current.color.copy(dayAmbient).lerp(nightAmbient, t);
    }
    if (directRef.current) {
      directRef.current.intensity = THREE.MathUtils.lerp(2.0, 0.05, t);
      directRef.current.color.copy(dayDirect).lerp(nightDirect, t);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.6, 0.15, t);
      (hemiRef.current as any).color.copy(daySky).lerp(nightSky, t);
      hemiRef.current.groundColor.copy(dayGround).lerp(nightGround, t);
    }
    if (pointRef.current) {
      pointRef.current.intensity = THREE.MathUtils.lerp(0, 0.3, t);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={1.4} />
      <directionalLight
        ref={directRef}
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
      <hemisphereLight ref={hemiRef} args={["#c9e8ff", "#a8c890", 0.6]} />
      <pointLight ref={pointRef} position={[0, -5, 0]} intensity={0} color="#220033" distance={500} />
    </>
  );
}

/** Smoothly lerps ground plane and background colors */
function DynamicGround({ nightMode }: { nightMode: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const bgRef = useRef<THREE.Color>(null);
  const lerpRef = useRef(0);

  const dayBg = useMemo(() => new THREE.Color("#b8d4e8"), []);
  const nightBg = useMemo(() => new THREE.Color("#020208"), []);
  const dayGround = useMemo(() => new THREE.Color("#b0b0a8"), []);
  const nightGround = useMemo(() => new THREE.Color("#08080f"), []);

  useFrame(({ scene }, delta) => {
    const target = nightMode ? 1 : 0;
    lerpRef.current = THREE.MathUtils.lerp(lerpRef.current, target, delta * 1.5);
    const t = lerpRef.current;

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(dayBg).lerp(nightBg, t);
    }
    if (matRef.current) {
      matRef.current.color.copy(dayGround).lerp(nightGround, t);
    }
  });

  return (
    <>
      <color ref={bgRef} attach="background" args={["#b8d4e8"]} />
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial ref={matRef} color="#b0b0a8" roughness={0.95} />
      </mesh>
    </>
  );
}

export default function CityCanvas({ data, nightMode = false }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cameraTarget, setCameraTarget] = useState({ x: 0, z: 0 });
  const [sherpaHighlightIds, setSherpaHighlightIds] = useState<Set<string>>(new Set());
  const [askTheCityHighlightIds, setAskTheCityHighlightIds] = useState<Set<string>>(new Set());
  const controlsRef = useRef<any>(null);

  const buildingMap = useMemo(() => {
    const map: Record<string, any> = {};
    data.buildings.forEach((b: any) => { map[b.id] = b; });
    return map;
  }, [data.buildings]);

  // Search: compute highlighted IDs
  const searchHighlightIds = useMemo(() => {
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

  // Merge search + sherpa highlights + ask the city highlights
  const highlightedIds = useMemo(() => {
    const merged = new Set<string>(searchHighlightIds);
    sherpaHighlightIds.forEach(id => merged.add(id));
    askTheCityHighlightIds.forEach(id => merged.add(id));
    return merged;
  }, [searchHighlightIds, sherpaHighlightIds, askTheCityHighlightIds]);

  const hasSearch = searchQuery.trim().length > 0;
  const hasHighlight = highlightedIds.size > 0;

  // Fly camera to first match
  useEffect(() => {
    if (highlightedIds.size === 0 || !controlsRef.current) return;
    const firstId = highlightedIds.values().next().value;
    if (!firstId) return;
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
  const camDistance = Math.max(cityBounds.width, cityBounds.depth) * 1.0 + 60;
  const camHeight = camDistance * 0.55;
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
        {/* Dynamic lighting that lerps between day/night */}
        <DynamicLights nightMode={nightMode} />

        {/* Dynamic sky background + ground plane */}
        <DynamicGround nightMode={nightMode} />

        {/* Day grid */}
        {!nightMode && (
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
        )}

        {/* Night mode: Tron grid */}
        {nightMode && (
          <gridHelper
            args={[2000, 100, "#1a1a3a", "#0d0d1f"]}
            position={[0, 0.05, 0]}
          />
        )}

        {/* District ground patches and labels */}
        <DistrictOverlay buildings={data.buildings} />

        {/* Complexity halos under every building */}
        {data.buildings.map((b: any) => (
          <ComplexityHalo key={`halo-${b.id}`} building={b} nightMode={nightMode} />
        ))}

        {/* Kenney building models */}
        <Suspense fallback={null}>
          {data.buildings.map((b: any) => (
            <group key={b.id}>
              <Building
                building={b}
                onClick={() => setSelected(b)}
                highlighted={highlightedIds.has(b.id)}
                dimmed={hasHighlight && !highlightedIds.has(b.id)}
                nightMode={nightMode}
              />
              {b.metadata.social?.heat_score > 0 && (
                <SocialHalo
                  position={b.position}
                  dimensions={b.dimensions}
                  heatScore={b.metadata.social.heat_score}
                  messageCount={b.metadata.social.message_count}
                />
              )}
            </group>
          ))}
        </Suspense>

        {/* Road connections */}
        {data.roads.map((r: any, i: number) => {
          const b1 = buildingMap[r.start_building_id];
          const b2 = buildingMap[r.end_building_id];
          const nearCamera = b1 && b2 && (
            Math.abs(b1.position.x - cameraTarget.x) < 150 &&
            Math.abs(b1.position.z - cameraTarget.z) < 150
          );

          return (
            <Road
              key={i}
              road={r}
              startBuilding={b1}
              endBuilding={b2}
              simplified={simplified}
              animated={!!nearCamera}
              nightMode={nightMode}
            />
          );
        })}

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

        {/* Post-processing effects */}
        <EffectComposer enabled={nightMode}>
          <Bloom
            intensity={nightMode ? 2.5 : 0}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.8}
          />
          <Vignette
            offset={0.4}
            darkness={nightMode ? 0.7 : 0}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
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
            {searchHighlightIds.size} match{searchHighlightIds.size !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {/* Minimap */}
      <Minimap
        buildings={data.buildings}
        cameraTarget={cameraTarget}
      />

      {/* Sherpa Mode */}
      <SherpaMode
        data={data}
        controlsRef={controlsRef}
        onHighlight={(ids: Set<string>) => setSherpaHighlightIds(ids)}
      />

      {/* Ask the City Overlay */}
      {data && (
        <AskTheCity
          data={data}
          onHighlight={(ids) => setAskTheCityHighlightIds(ids)}
        />
      )}

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
