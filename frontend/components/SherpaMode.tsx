"use client";
import { useState, useEffect, useCallback } from "react";
import * as THREE from "three";

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
}

export default function SherpaMode({ data, controlsRef, onHighlight }: Props) {
    const [open, setOpen] = useState(false);
    const [questTypes, setQuestTypes] = useState<QuestType[]>([]);
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [generating, setGenerating] = useState(false);

    // Load quest types on mount
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sherpa/quests`)
            .then(r => r.json())
            .then(d => setQuestTypes(d.quests))
            .catch(() => { });
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
            const quest: Quest = await resp.json();
            setActiveQuest(quest);
            setCurrentStep(0);
            setOpen(false);
            // Fly to first stop
            if (quest.steps.length > 0) {
                flyToBuilding(quest.steps[0].building_id);
            }
        } catch (e) {
            console.error("Quest generation failed:", e);
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
            {/* Sherpa toggle button */}
            {!activeQuest && (
                <button
                    onClick={() => setOpen(o => !o)}
                    className={`absolute top-16 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${open
                            ? "bg-emerald-900/90 border-emerald-500 text-emerald-300"
                            : "bg-gray-900/90 border-gray-700 text-gray-300 hover:border-gray-500"
                        }`}
                >
                    🧭 Sherpa Mode
                </button>
            )}

            {/* Quest picker panel */}
            {open && !activeQuest && (
                <div className="absolute top-28 right-4 z-20 w-72 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                    <div className="px-4 py-3 border-b border-gray-700">
                        <h3 className="text-white font-bold text-sm">🧭 Choose Your Quest</h3>
                        <p className="text-gray-400 text-xs mt-1">
                            AI will guide you through the codebase
                        </p>
                    </div>

                    <div className="p-2">
                        {questTypes.map(qt => (
                            <button
                                key={qt.id}
                                onClick={() => startQuest(qt.id)}
                                disabled={generating}
                                className="w-full text-left px-3 py-3 rounded-lg hover:bg-gray-800 transition-colors mb-1 disabled:opacity-50"
                            >
                                <div className="text-white text-sm font-medium">{qt.title}</div>
                                <div className="text-gray-400 text-xs mt-0.5">{qt.description}</div>
                            </button>
                        ))}
                    </div>

                    {generating && (
                        <div className="px-4 py-3 border-t border-gray-700 text-center">
                            <div className="text-emerald-400 text-sm animate-pulse">
                                🤖 Sherpa is planning your route...
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Active quest UI — bottom panel */}
            {activeQuest && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[520px] max-w-[90vw] bg-gray-900/97 backdrop-blur border border-emerald-700/50 rounded-2xl shadow-2xl overflow-hidden">

                    {/* Quest header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-emerald-900/30 border-b border-emerald-700/30">
                        <div>
                            <div className="text-emerald-300 font-bold text-sm">{activeQuest.title}</div>
                            <div className="text-gray-400 text-xs mt-0.5">{activeQuest.description}</div>
                        </div>
                        <button
                            onClick={exitQuest}
                            className="text-gray-500 hover:text-white text-lg leading-none"
                        >×</button>
                    </div>

                    {/* Step progress dots */}
                    <div className="flex items-center gap-1.5 px-5 pt-3">
                        {activeQuest.steps.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToStep(i)}
                                className={`h-1.5 rounded-full transition-all ${i === currentStep
                                        ? "bg-emerald-400 w-6"
                                        : i < currentStep
                                            ? "bg-emerald-700 w-3"
                                            : "bg-gray-600 w-3"
                                    }`}
                            />
                        ))}
                        <span className="text-gray-500 text-xs ml-2">
                            {currentStep + 1} / {activeQuest.steps.length}
                        </span>
                    </div>

                    {/* Current step content */}
                    {activeQuest.steps[currentStep] && (
                        <div className="px-5 py-4">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                    <span className="text-emerald-400 text-xs font-bold">
                                        {activeQuest.steps[currentStep].order}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-mono text-sm font-medium mb-2">
                                        📄 {activeQuest.steps[currentStep].building_name}
                                    </div>
                                    <p className="text-gray-300 text-sm leading-relaxed">
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
