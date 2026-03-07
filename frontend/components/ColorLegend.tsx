"use client";
import { useState } from "react";

export default function ColorLegend() {
    const [open, setOpen] = useState(false);

    const entries = [
        {
            category: "Building Height",
            items: [
                { label: "Short building — few lines of code (< 50 LOC)" },
                { label: "Tall building — many lines of code (> 400 LOC)" },
            ],
        },
        {
            category: "Complexity Rings",
            items: [
                { swatch: "#22c55e", label: "🟢 Pristine — complexity < 3" },
                { swatch: "#84cc16", label: "🟡 Healthy — complexity 3–5" },
                { swatch: "#eab308", label: "🟡 Moderate — complexity 5–8" },
                { swatch: "#f97316", label: "🟠 Elevated — complexity 8–11" },
                { swatch: "#ef4444", label: "🔴 Critical — complexity > 11" },
            ],
        },
        {
            category: "Social Activity",
            items: [
                { swatch: "#f97316", label: "🟠 Orange pulsing ring — team discussions active" },
                { swatch: "#ef4444", label: "🔴 Fast pulse — high heat (many messages)" },
            ],
        },
        {
            category: "Roads",
            items: [
                { swatch: "#6699bb", label: "Blue flat road — import within same district" },
                { swatch: "#cc9933", label: "Gold elevated bridge — cross-district import" },
                { swatch: "#00ccff", label: "Cyan pulse — import direction indicator" },
            ],
        },
        {
            category: "Building Archetypes",
            items: [
                { emoji: "🏠", label: "House — < 50 lines (tiny utility file)" },
                { emoji: "🏢", label: "Apartment — 50–150 lines (small module)" },
                { emoji: "🏬", label: "Tower — 150–400 lines (core module)" },
                { emoji: "🏙️", label: "Skyscraper — > 400 lines (major file)" },
            ],
        },
        {
            category: "Overlays",
            items: [
                { emoji: "🏗️", label: "Crane — modified in last 7 days" },
                { emoji: "💨", label: "Smoke — high complexity + high churn (tech debt)" },
                { emoji: "🔥", label: "Red emissive tint — hotspot file (refactor needed)" },
            ],
        },
    ];

    return (
        <div className="absolute bottom-6 left-6 z-20" style={{ maxWidth: 260 }}>
            {/* Toggle button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`city-panel flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200 ${open
                    ? 'bg-gray-800 border-gray-600 text-gray-200'
                    : 'bg-gray-900/90 backdrop-blur border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
            >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <circle cx="6.5" cy="6.5" r="5.5" />
                    <path d="M6.5 3v4M6.5 9.5v.5" strokeLinecap="round" />
                </svg>
                Color Legend
                <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    stroke="currentColor" strokeWidth="1.3"
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                >
                    <path d="M2 3.5L5 6.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* Legend panel — opens above the button */}
            {open && (
                <div className="city-panel absolute bottom-10 left-0 w-64 bg-gray-900/97 backdrop-blur border border-gray-700 rounded-xl overflow-hidden shadow-2xl animate-fade-in">
                    <div className="city-panel-header px-4 py-3 border-b border-gray-700/60 flex items-center justify-between">
                        <span className="text-white text-sm font-semibold">Color Legend</span>
                        <button
                            onClick={() => setOpen(false)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
                        >×</button>
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                        {entries.map(cat => (
                            <div key={cat.category} className="px-4 py-3 border-b border-gray-800 last:border-0">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">
                                    {cat.category}
                                </div>
                                <div className="space-y-1.5">
                                    {cat.items.map((item: any, i) => (
                                        <div key={i} className="flex items-center gap-2.5">
                                            {/* Color swatch or emoji or placeholder */}
                                            {item.swatch ? (
                                                <div
                                                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                                    style={{ background: item.swatch, boxShadow: `0 0 4px ${item.swatch}80` }}
                                                />
                                            ) : item.emoji ? (
                                                <span className="text-sm flex-shrink-0">{item.emoji}</span>
                                            ) : (
                                                <div className="w-3.5 h-3.5 flex-shrink-0" />
                                            )}
                                            <span className="text-gray-300 text-xs leading-relaxed">
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
