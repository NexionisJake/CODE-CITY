"use client";
import { useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { DropdownMenu } from "./ui/dropdown-menu";

const QUEST_VISUAL: Record<string, { icon: string; color: string; borderColor: string; bgColor: string }> = {
    architecture: {
        icon: "🏛️",
        color: "text-blue-400",
        borderColor: "border-blue-500/50",
        bgColor: "bg-blue-500/5 hover:bg-blue-500/10",
    },
    data_flow: {
        icon: "🌊",
        color: "text-cyan-400",
        borderColor: "border-cyan-500/50",
        bgColor: "bg-cyan-500/5 hover:bg-cyan-500/10",
    },
    hotspots: {
        icon: "🔥",
        color: "text-red-400",
        borderColor: "border-red-500/50",
        bgColor: "bg-red-500/5 hover:bg-red-500/10",
    },
    onboarding: {
        icon: "👋",
        color: "text-green-400",
        borderColor: "border-green-500/50",
        bgColor: "bg-green-500/5 hover:bg-green-500/10",
    },
    dependencies: {
        icon: "🕸️",
        color: "text-purple-400",
        borderColor: "border-purple-500/50",
        bgColor: "bg-purple-500/5 hover:bg-purple-500/10",
    },
};

interface QuestStep {
    building_id: string;
    building_name: string;
    order: number;
    narration: string;
    focus: string;
}

interface Quest {
    title: string;
    description: string;
    steps: QuestStep[];
}

interface QuestType {
    id: string;
    title: string;
    description: string;
}

interface Props {
    data: any;
    controlsRef: React.RefObject<any>;
    onHighlight: (ids: Set<string>) => void;
    onFlyTo?: (pos: { x: number; z: number }) => void;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

export default function SherpaMode({ data, controlsRef, onHighlight, isOpen, onOpen, onClose }: Props) {
    const [questTypes, setQuestTypes] = useState<QuestType[]>([]);
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [questError, setQuestError] = useState<string | null>(null);

    const FALLBACK_QUESTS: QuestType[] = [
        { id: "architecture",  title: "Architecture Tour",   description: "Walk the key structural files of this codebase" },
        { id: "hotspots",      title: "Hotspot Hunt",        description: "Visit the most complex and risky files" },
        { id: "data_flow",     title: "Data Flow",           description: "Follow the main data path end to end" },
        { id: "onboarding",    title: "New Dev Onboarding",  description: "The five files every new contributor should read first" },
        { id: "dependencies",  title: "Dependency Web",      description: "Explore the most heavily imported modules" },
    ];

    // Load quest types on mount
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sherpa/quests`)
            .then(r => r.json())
            .then(d => setQuestTypes(d.quests?.length ? d.quests : FALLBACK_QUESTS))
            .catch(() => setQuestTypes(FALLBACK_QUESTS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fly camera to a building
    const flyToBuilding = useCallback((buildingId: string) => {
        const building = data.buildings.find((b: any) => b.id === buildingId);
        if (!building || !controlsRef.current) return;

        const target = new THREE.Vector3(building.position.x, 0, building.position.z);

        // Animate OrbitControls target toward building
        const startTarget = controlsRef.current.target.clone();
        const startTime = Date.now();
        const duration = 1500; // ms

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out

            controlsRef.current.target.lerpVectors(startTarget, target, eased);
            controlsRef.current.update();

            if (t < 1) requestAnimationFrame(animate);
        };
        animate();

        // Highlight this building
        onHighlight(new Set([buildingId]));
    }, [data.buildings, controlsRef, onHighlight]);

    // Start a quest
    const startQuest = async (questType: string) => {
        setGenerating(true);
        setQuestError(null);
        try {
            const resp = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/sherpa/generate`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        quest_type: questType,
                        buildings: data.buildings,
                        roads: data.roads,
                    }),
                }
            );
            if (!resp.ok) throw new Error(`Server error ${resp.status}`);
            const quest: Quest = await resp.json();
            setActiveQuest(quest);
            setCurrentStep(0);
            onClose(); // close the picker panel
            // Fly to first stop
            if (quest.steps.length > 0) {
                flyToBuilding(quest.steps[0].building_id);
            }
        } catch {
            setQuestError("Quest generation failed — try again.");
        } finally {
            setGenerating(false);
        }
    };

    // Navigate steps
    const goToStep = (index: number) => {
        if (!activeQuest) return;
        const step = activeQuest.steps[index];
        if (step) {
            setCurrentStep(index);
            flyToBuilding(step.building_id);
        }
    };

    const exitQuest = () => {
        setActiveQuest(null);
        setCurrentStep(0);
        onHighlight(new Set());
    };

    if (!data) return null;

    return (
        <>
            {/* Sherpa toggle button and Dropdown */}
            {!activeQuest && (
                <div className="absolute top-16 right-4 z-40">
                    <DropdownMenu
                        open={isOpen}
                        onOpenChange={(open) => open ? onOpen() : onClose()}
                        menuWidth="w-[320px]"
                        align="end"
                        options={questTypes.map(qt => {
                            const visual = QUEST_VISUAL[qt.id] ?? {
                                icon: "🗺️", color: "text-gray-400",
                                borderColor: "border-gray-600", bgColor: "bg-gray-800/50 hover:bg-gray-800",
                            };
                            return {
                                label: (
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className={`text-sm font-semibold ${visual.color} mb-0.5`}>
                                            {qt.title}
                                        </div>
                                        <div className="text-gray-400 text-xs leading-snug">
                                            {qt.description}
                                        </div>
                                    </div>
                                ),
                                Icon: (
                                    <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                                        {visual.icon}
                                    </span>
                                ),
                                onClick: () => startQuest(qt.id)
                            };
                        })}
                        customPanel={generating ? (
                            <div className="px-4 py-4 flex flex-col items-center gap-3">
                                {/* Spinner */}
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full border-2 border-emerald-900 border-t-emerald-400 animate-spin" />
                                    <span className="absolute inset-0 flex items-center justify-center text-sm">
                                        🧭
                                    </span>
                                </div>
                                <div className="text-center">
                                    <p className="text-emerald-400 text-sm font-medium">Planning your route…</p>
                                    <p className="text-gray-500 text-xs mt-0.5">Claude is choosing the best stops</p>
                                </div>
                            </div>
                        ) : questError ? (
                            <div className="px-4 py-4 flex flex-col items-center gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div className="text-center">
                                    <p className="text-red-400 text-sm font-medium">{questError}</p>
                                    <button
                                        onClick={() => setQuestError(null)}
                                        className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        ) : undefined}
                    >
                        <span className="flex items-center gap-2">🧭 Sherpa Mode</span>
                    </DropdownMenu>
                </div>
            )}
            {/* Active quest UI — bottom panel */}
            {activeQuest && (
                <div className="city-panel absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[520px] max-w-[90vw] bg-gray-900/95 backdrop-blur border border-emerald-700/50 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Quest header */}
                    <div className="city-panel-header flex items-center justify-between px-5 py-3 bg-emerald-900/30 border-b border-emerald-700/30">
                        <div>
                            <div className="text-emerald-300 font-bold text-sm">{activeQuest.title}</div>
                            <div className="text-gray-400 text-xs mt-0.5">{activeQuest.description}</div>
                        </div>
                        <button
                            onClick={exitQuest}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-600 text-gray-400 hover:text-white transition-all duration-150 text-base flex-shrink-0"
                            title="Exit quest"
                        >×</button>
                    </div>

                    {/* Step dots */}
                    <div className="flex items-center gap-1.5 px-5 pt-4 pb-2">
                        {activeQuest.steps.map((step, i) => (
                            <button
                                key={i}
                                onClick={() => goToStep(i)}
                                title={step.building_name}
                                className={`transition-all duration-300 rounded-full ${i === currentStep
                                    ? "bg-emerald-400 w-6 h-2"
                                    : i < currentStep
                                        ? "bg-emerald-700 w-2 h-2 hover:bg-emerald-600"
                                        : "bg-gray-600 w-2 h-2 hover:bg-gray-500"
                                    }`}
                            />
                        ))}
                        <span className="text-gray-500 text-xs ml-2 flex-shrink-0">
                            Stop {currentStep + 1} of {activeQuest.steps.length}
                        </span>
                    </div>

                    {/* Current step content */}
                    {activeQuest.steps[currentStep] && (
                        <div className="px-5 py-4">
                            <div className="flex items-start gap-3">
                                {/* Step number badge */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mt-0.5">
                                    <span className="text-emerald-400 text-sm font-bold">
                                        {activeQuest.steps[currentStep].order}
                                    </span>
                                </div>

                                <div className="flex-1">
                                    {/* Filename */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs">📄</span>
                                        <code className="text-white font-mono text-xs bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                            {activeQuest.steps[currentStep].building_name}
                                        </code>
                                        {/* Focus badge */}
                                        {activeQuest.steps[currentStep].focus && (
                                            <span className="text-xs text-gray-500 bg-gray-800/60 px-1.5 py-0.5 rounded capitalize">
                                                {activeQuest.steps[currentStep].focus}
                                            </span>
                                        )}
                                    </div>

                                    {/* Narration — with a left accent */}
                                    <p className="text-gray-300 text-sm leading-relaxed border-l-2 border-emerald-500/30 pl-3">
                                        {activeQuest.steps[currentStep].narration}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between px-5 pb-4">
                        <button
                            onClick={() => goToStep(currentStep - 1)}
                            disabled={currentStep === 0}
                            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-30 hover:bg-gray-700 transition"
                        >
                            ← Previous
                        </button>

                        <span className="text-gray-500 text-xs">
                            {activeQuest.steps[currentStep]?.focus && (
                                <span className="bg-gray-800 px-2 py-1 rounded text-gray-400">
                                    Focus: {activeQuest.steps[currentStep].focus}
                                </span>
                            )}
                        </span>

                        {currentStep < activeQuest.steps.length - 1 ? (
                            <button
                                onClick={() => goToStep(currentStep + 1)}
                                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-600 transition"
                            >
                                Next Stop →
                            </button>
                        ) : (
                            <button
                                onClick={exitQuest}
                                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm hover:bg-emerald-600 transition"
                            >
                                ✅ Complete Quest
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
