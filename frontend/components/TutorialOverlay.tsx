"use client";
import { useState, useEffect } from "react";

interface Props {
    onDismiss: () => void;
}

const CONTROLS = [
    {
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                {/* Mouse with drag arrows */}
                <rect x="9" y="6" width="10" height="14" rx="5" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
                <path d="M14 6v5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
                {/* Arrows indicating drag/rotate */}
                <path d="M5 14l-2 2 2 2" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 14l2 2-2 2" stroke="#93c5fd" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
        action: "Left-drag",
        result: "Rotate the city",
        hint: "Orbit around any building to see it from all angles",
    },
    {
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                {/* Scroll wheel icon */}
                <rect x="9" y="6" width="10" height="14" rx="5" stroke="#34d399" strokeWidth="1.5" fill="none" />
                <path d="M14 9v4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
                {/* Up/down arrows for scroll */}
                <path d="M14 3l-2 2.5h4L14 3z" fill="#6ee7b7" />
                <path d="M14 25l2-2.5h-4L14 25z" fill="#6ee7b7" />
            </svg>
        ),
        action: "Scroll",
        result: "Zoom in / out",
        hint: "Zoom all the way in to read building details",
    },
    {
        icon: (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                {/* Cursor clicking a building */}
                <rect x="5" y="8" width="8" height="12" rx="1" fill="#f59e0b" opacity="0.3" />
                <rect x="6" y="9" width="6" height="10" rx="0.5" stroke="#f59e0b" strokeWidth="1" fill="none" />
                {/* Click cursor */}
                <path d="M16 12l6 6-2.5 0.5L21 21l-1.5-1.5-0.5 2.5-4-6" fill="#fbbf24" />
                {/* Pulse effect */}
                <circle cx="16" cy="12" r="3" stroke="#fbbf24" strokeWidth="1" opacity="0.4" />
            </svg>
        ),
        action: "Click any building",
        result: "See AI insights",
        hint: "Get complexity stats, AI summary, and team discussions",
    },
];

export default function TutorialOverlay({ onDismiss }: Props) {
    const [visible, setVisible] = useState(true);
    const [dismissing, setDismissing] = useState(false);
    const [countdown, setCountdown] = useState(8);
    const [activeStep, setActiveStep] = useState(0);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) {
                    clearInterval(interval);
                    handleDismiss();
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Cycle through steps automatically
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep(s => (s + 1) % CONTROLS.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const handleDismiss = () => {
        setDismissing(true);
        setTimeout(() => {
            setVisible(false);
            onDismiss();
        }, 300);
    };

    if (!visible) return null;

    return (
        <div
            className={`
        absolute inset-0 z-50 flex items-end justify-center pb-16 pointer-events-none
        transition-opacity duration-300
        ${dismissing ? 'opacity-0' : 'opacity-100'}
      `}
        >
            {/* Dark overlay — subtle, not full black (so city is still visible) */}
            <div
                className="absolute inset-0 bg-black/30 pointer-events-auto"
                onClick={handleDismiss}
            />

            {/* Tutorial card */}
            <div
                className="relative pointer-events-auto animate-slide-up"
                style={{ animationDuration: '0.4s' }}
            >
                <div className="bg-gray-900/97 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
                    style={{ width: 480 }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700/60 bg-gray-800/40">
                        <div className="flex items-center gap-2.5">
                            {/* Animated city icon */}
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="1" y="8" width="3" height="7" rx="0.5" fill="#60a5fa" />
                                    <rect x="6" y="5" width="4" height="10" rx="0.5" fill="#3b82f6" />
                                    <rect x="12" y="6" width="3" height="9" rx="0.5" fill="#2563eb" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-white text-sm font-semibold">Welcome to CodeCity</div>
                                <div className="text-gray-400 text-xs">Navigate your codebase in 3D</div>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-700/60 hover:bg-gray-600 text-gray-400 hover:text-white transition-all duration-150 text-base"
                        >
                            ×
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="px-5 py-4">
                        <div className="flex gap-3">
                            {CONTROLS.map((control, i) => (
                                <div
                                    key={i}
                                    onClick={() => setActiveStep(i)}
                                    className={`
                    flex-1 flex flex-col items-center gap-2.5 p-3.5 rounded-xl border cursor-pointer
                    transition-all duration-300
                    ${activeStep === i
                                            ? 'bg-blue-500/10 border-blue-500/40 scale-[1.03]'
                                            : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800'
                                        }
                  `}
                                >
                                    {/* Icon */}
                                    <div className={`transition-transform duration-300 ${activeStep === i ? 'scale-110' : 'scale-100'}`}>
                                        {control.icon}
                                    </div>

                                    {/* Action */}
                                    <div className="text-center">
                                        <div className={`text-xs font-bold mb-0.5 transition-colors duration-200 ${activeStep === i ? 'text-blue-300' : 'text-gray-300'
                                            }`}>
                                            {control.action}
                                        </div>
                                        <div className={`text-xs font-medium transition-colors duration-200 ${activeStep === i ? 'text-white' : 'text-gray-400'
                                            }`}>
                                            {control.result}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Active step hint */}
                        <div className="mt-3 text-center h-5">
                            <p className="text-gray-400 text-xs animate-fade-in" key={activeStep}>
                                💡 {CONTROLS[activeStep].hint}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700/60 bg-gray-800/20">
                        {/* Keyboard shortcuts hint */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>
                                <kbd className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 font-mono text-xs text-gray-300">N</kbd>
                                {" "}Night mode
                            </span>
                            <span>
                                <kbd className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 font-mono text-xs text-gray-300">/</kbd>
                                {" "}Search
                            </span>
                            <span>
                                <kbd className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 font-mono text-xs text-gray-300">Home</kbd>
                                {" "}Reset view
                            </span>
                        </div>

                        {/* Dismiss with countdown */}
                        <div className="flex items-center gap-2">
                            {/* Circular countdown */}
                            <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                                <circle cx="10" cy="10" r="8" stroke="#374151" strokeWidth="2" fill="none" />
                                <circle
                                    cx="10" cy="10" r="8"
                                    stroke="#3b82f6" strokeWidth="2" fill="none"
                                    strokeDasharray={`${(countdown / 8) * 50.3} 50.3`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 10 10)"
                                    style={{ transition: 'stroke-dasharray 1s linear' }}
                                />
                                <text x="10" y="13.5" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="monospace">
                                    {countdown}
                                </text>
                            </svg>
                            <button
                                onClick={handleDismiss}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
