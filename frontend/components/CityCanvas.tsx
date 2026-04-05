"use client";
import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from "react";
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
import ColorLegend from "./ColorLegend";
import TutorialOverlay from "./TutorialOverlay";
import SwitchToggleThemeDemo from "@/components/ui/toggle-theme";

interface Props {
  data: any;
  nightMode?: boolean;
  onNightModeToggle?: () => void;
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

export default function CityCanvas({ data, nightMode = false, onNightModeToggle }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cameraTarget, setCameraTarget] = useState({ x: 0, z: 0 });
  const [sherpaHighlightIds, setSherpaHighlightIds] = useState<Set<string>>(new Set());
  const [askTheCityHighlightIds, setAskTheCityHighlightIds] = useState<Set<string>>(new Set());
  const [activePanel, setActivePanel] = useState<"sherpa" | "ask" | null>(null);
  const [statFilter, setStatFilter] = useState<"hotspots" | "discussed" | "recent" | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const controlsRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Add state — track if tutorial has been shown this session
  // (use sessionStorage so it shows once per session, not per page load)
  const [showTutorial, setShowTutorial] = useState(false);
  const [cameraDistance, setCameraDistance] = useState(200);

  // Fade the canvas in on mount
  useEffect(() => {
    const timer = setTimeout(() => setCanvasVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Show tutorial when city first loads
  useEffect(() => {
    if (data && !sessionStorage.getItem("codecity_tutorial_shown")) {
      // Small delay so the city finishes building before overlay appears
      const timer = setTimeout(() => setShowTutorial(true), 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const handleTutorialDismiss = () => {
    setShowTutorial(false);
    sessionStorage.setItem("codecity_tutorial_shown", "1");
  };

  const buildingMap = useMemo(() => {
    const map: Record<string, any> = {};
    data.buildings.forEach((b: any) => { map[b.id] = b; });
    return map;
  }, [data.buildings]);

  // Pre-compute stat highlight sets
  const statHighlightSets = useMemo(() => {
    if (!data) return {} as Record<string, Set<string>>;
    return {
      hotspots: new Set<string>(data.buildings.filter((b: any) => b.metadata.is_hotspot).map((b: any) => b.id)),
      discussed: new Set<string>(data.buildings.filter((b: any) => b.metadata.social?.message_count > 0).map((b: any) => b.id)),
      recent: new Set<string>(data.buildings.filter((b: any) => b.metadata.git_churn?.is_recent).map((b: any) => b.id)),
    };
  }, [data]);

  // Handle search — clears stat filter when user types
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query) setStatFilter(null); // clear stat filter when searching
  }, []);

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

  // Merge search + sherpa + ask the city highlights
  const highlightedIds = useMemo(() => {
    const merged = new Set<string>(searchHighlightIds);
    sherpaHighlightIds.forEach(id => merged.add(id));
    askTheCityHighlightIds.forEach(id => merged.add(id));
    return merged;
  }, [searchHighlightIds, sherpaHighlightIds, askTheCityHighlightIds]);

  // Effective highlights: stat filter takes priority when active
  const effectiveHighlights = useMemo(() => {
    if (statFilter && statHighlightSets[statFilter]) {
      return statHighlightSets[statFilter] as Set<string>;
    }
    return highlightedIds;
  }, [statFilter, statHighlightSets, highlightedIds]);

  const hasHighlight = effectiveHighlights.size > 0;

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

  // Smooth camera reset to city center
  const resetCamera = useCallback(() => {
    if (!controlsRef.current) return;
    const target = new THREE.Vector3(cityBounds.centerX, 0, cityBounds.centerZ);
    const startTarget = controlsRef.current.target.clone();
    const startTime = Date.now();
    const duration = 800;
    const animate = () => {
      const t = Math.min((Date.now() - startTime) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      controlsRef.current.target.lerpVectors(startTarget, target, eased);
      controlsRef.current.update();
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [cityBounds]);

  // Keyboard shortcuts: / focuses search, Escape clears, Home resets camera
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active?.tagName !== "INPUT" && active?.tagName !== "TEXTAREA") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setStatFilter(null);
        searchInputRef.current?.blur();
      }
      if (e.key === "Home") {
        resetCamera();
      }
    };
    window.addEventListener("keydown", handler);
    // Also listen for the Reset button event from the parent page
    const handleResetEvent = () => resetCamera();
    window.addEventListener("codecity:resetCamera", handleResetEvent);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("codecity:resetCamera", handleResetEvent);
    };
  }, [resetCamera]);

  // Stat items for the stats bar (clickable ones highlight buildings)
  const statItems = useMemo(() => [
    {
      icon: "📄",
      value: data.buildings.length,
      label: "files",
      filter: null as null,
      tip: "Total source files",
    },
    {
      icon: "🔗",
      value: data.roads.length,
      label: "connections",
      filter: null as null,
      tip: "Import dependencies",
    },
    {
      icon: "🔥",
      value: statHighlightSets.hotspots?.size ?? 0,
      label: "hotspots",
      filter: "hotspots" as const,
      color: "text-red-400",
      tip: "Click to highlight high-complexity files",
    },
    ...(statHighlightSets.discussed?.size ?? 0) > 0 ? [{
      icon: "💬",
      value: statHighlightSets.discussed?.size ?? 0,
      label: "discussed",
      filter: "discussed" as const,
      color: "text-orange-400",
      tip: "Click to highlight team-discussed files",
    }] : [],
  ], [data, statHighlightSets]);

  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        camera={{ position: [camX, camHeight, camZ], fov: 55, near: 1, far: 8000 }}
        style={{
          background: "#b8d4e8",
          opacity: canvasVisible ? 1 : 0,
          transition: 'opacity 500ms ease-out',
        }}
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
        <DistrictOverlay buildings={data.buildings} cameraDistance={cameraDistance} />

        {/* Complexity halos under every building */}
        {data.buildings.map((b: any) => (
          <ComplexityHalo key={`halo-${b.id}`} building={b} nightMode={nightMode} />
        ))}

        {/* Kenney building models */}
        <Suspense fallback={null}>
          {data.buildings.map((b: any, i: number) => (
            <group key={b.id}>
              <Building
                building={b}
                onClick={() => setSelected(b)}
                highlighted={effectiveHighlights.has(b.id)}
                dimmed={hasHighlight && !effectiveHighlights.has(b.id)}
                nightMode={nightMode}
                revealDelay={Math.min(i * 30, 1200)}
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
              setCameraDistance(controlsRef.current.getDistance());
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

      {/* Enhanced Search overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
        <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 hover:border-gray-600 focus-within:border-blue-500/60 focus-within:shadow-lg focus-within:shadow-blue-500/10 rounded-lg px-3 py-2 transition-all duration-200">
          {/* Search icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500 flex-shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="m9.5 9.5 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search files..."
            className="bg-transparent text-white text-sm outline-none w-44 placeholder-gray-600"
          />

          {/* Match count OR keyboard shortcut hint */}
          {searchQuery ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {searchHighlightIds.size > 0 && (
                <span className="text-blue-400 text-xs font-medium">
                  {searchHighlightIds.size}
                </span>
              )}
              <button
                onClick={() => handleSearch("")}
                className="text-gray-600 hover:text-white text-sm transition-colors"
              >×</button>
            </div>
          ) : (
            <kbd className="flex-shrink-0 text-gray-600 text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 font-mono">
              /
            </kbd>
          )}
        </div>

        {/* Result count below input */}
        {searchHighlightIds.size > 0 && searchQuery && (
          <div className="text-xs text-gray-500 px-1 animate-fade-in">
            {searchHighlightIds.size} match{searchHighlightIds.size !== 1 ? 'es' : ''} — others dimmed
          </div>
        )}

        {/* Stat filter indicator */}
        {statFilter && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 px-1 animate-fade-in">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Filtering by {statFilter} — <button onClick={() => setStatFilter(null)} className="text-blue-400 hover:text-blue-300">clear</button>
          </div>
        )}
      </div>

      {/* Clickable stats bar + camera controls — top-right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <div className="flex items-center bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg overflow-hidden text-sm">
          {statItems.map((stat, i) => (
            <div
              key={stat.label}
              className={`
                flex items-center gap-1.5 px-3 py-2
                ${i > 0 ? 'border-l border-gray-700/60' : ''}
                ${stat.filter ? 'cursor-pointer hover:bg-gray-700/50 transition-colors' : ''}
                ${statFilter === stat.filter && stat.filter ? 'bg-gray-700/60' : ''}
              `}
              onClick={() => {
                if (stat.filter) {
                  setStatFilter(f => f === stat.filter ? null : stat.filter);
                  if (stat.filter !== statFilter) handleSearch("");
                }
              }}
              title={stat.tip}
            >
              <span className="text-xs">{stat.icon}</span>
              <span className={`font-semibold ${'color' in stat ? stat.color : 'text-gray-200'}`}>
                {stat.value}
              </span>
              <span className="text-gray-500 text-xs hidden sm:inline">{stat.label}</span>
              {/* Active filter indicator dot */}
              {statFilter === stat.filter && stat.filter && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />
              )}
            </div>
          ))}
        </div>

        {/* Camera reset button */}
        <button
          onClick={() => resetCamera()}
          className="ml-1 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 text-gray-400 hover:text-white text-xs transition-all duration-200"
          title="Reset camera view (Home)"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 6.5h10M6.5 1.5v10M3 4l-1.5 2.5L3 9M10 4l1.5 2.5L10 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Night mode toggle */}
        {onNightModeToggle && (
          <div title="Night Mode (N)">
            <SwitchToggleThemeDemo
              isDark={nightMode}
              onToggle={() => onNightModeToggle()}
            />
          </div>
        )}

        {/* Help button */}
        <button
          onClick={() => setShowTutorial(true)}
          className="ml-1 w-8 h-8 flex items-center justify-center bg-gray-900/90 backdrop-blur border border-gray-700 hover:border-gray-500 rounded-lg text-gray-500 hover:text-gray-300 transition-all duration-150 text-sm font-bold"
          title="Show controls guide"
        >
          ?
        </button>
      </div>

      {/* Minimap — bottom-right */}
      <Minimap
        buildings={data.buildings}
        cameraTarget={cameraTarget}
        onNavigate={(worldX, worldZ) => {
          if (!controlsRef.current) return;
          const target = new THREE.Vector3(worldX, 0, worldZ);
          controlsRef.current.target.lerp(target, 1.0);
          controlsRef.current.update();
        }}
      />

      {/* Color Legend — bottom-left */}
      <ColorLegend />

      {/* Sherpa Mode — mutually exclusive with Ask the City */}
      <SherpaMode
        data={data}
        controlsRef={controlsRef}
        onHighlight={(ids: Set<string>) => setSherpaHighlightIds(ids)}
        isOpen={activePanel === "sherpa"}
        onOpen={() => setActivePanel("sherpa")}
        onClose={() => setActivePanel(null)}
      />

      {/* Ask the City Overlay — mutually exclusive with Sherpa */}
      {data && (
        <AskTheCity
          data={data}
          onHighlight={(ids) => setAskTheCityHighlightIds(ids)}
          isOpen={activePanel === "ask"}
          onOpen={() => setActivePanel("ask")}
          onClose={() => setActivePanel(null)}
          onFlyTo={(worldX, worldZ) => {
            if (!controlsRef.current) return;
            const target = new THREE.Vector3(worldX, 0, worldZ);
            const startTarget = controlsRef.current.target.clone();
            const startTime = Date.now();
            const duration = 1000;
            const animate = () => {
              const t = Math.min((Date.now() - startTime) / duration, 1);
              const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
              controlsRef.current.target.lerpVectors(startTarget, target, eased);
              controlsRef.current.update();
              if (t < 1) requestAnimationFrame(animate);
            };
            animate();
          }}
        />
      )}

      {/* HTML overlay — outside Canvas */}
      {selected && (
        <BuildingTooltip
          building={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {showTutorial && (
        <TutorialOverlay onDismiss={handleTutorialDismiss} />
      )}
    </>
  );
}
