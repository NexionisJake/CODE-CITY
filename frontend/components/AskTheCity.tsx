"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading";

// ─── Inline Markdown + Clickable Filenames Renderer ─────────────────────────

interface RenderedMessageProps {
    text: string;
    buildings: any[];
    onFileClick: (buildingId: string) => void;
}

function RenderedMessage({ text, buildings, onFileClick }: RenderedMessageProps) {
    // Build a map: filename stem → building id (for quick lookup)
    const fileMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const b of buildings) {
            const path = (b.file_path || b.id || "").replace(/\\/g, "/");
            const filename = path.split("/").pop() || "";
            const stem = filename.replace(/\.[^.]+$/, "");
            // Map both "auth.py" and "auth" → building id
            map.set(filename.toLowerCase(), b.id);
            map.set(stem.toLowerCase(), b.id);
            // Also map the last two path segments: "utils/auth.py"
            const parts = path.split("/");
            if (parts.length >= 2) {
                map.set(parts.slice(-2).join("/").toLowerCase(), b.id);
            }
        }
        return map;
    }, [buildings]);

    // Parse the text into segments
    const renderLine = (line: string, lineIdx: number) => {
        // Split line into tokens: **bold**, `code`, plain text, and file references
        const tokens: React.ReactNode[] = [];
        let remaining = line;
        let tokenIdx = 0;

        while (remaining.length > 0) {
            // Bold: **text**
            const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
            if (boldMatch) {
                tokens.push(
                    <strong key={tokenIdx++} className="text-white font-semibold">
                        {boldMatch[1]}
                    </strong>
                );
                remaining = remaining.slice(boldMatch[0].length);
                continue;
            }

            // Code/filename: `text`
            const codeMatch = remaining.match(/^`([^`]+)`/);
            if (codeMatch) {
                const code = codeMatch[1];
                const buildingId = fileMap.get(code.toLowerCase());
                if (buildingId) {
                    tokens.push(
                        <button
                            key={tokenIdx++}
                            onClick={() => onFileClick(buildingId)}
                            className="inline font-mono text-xs bg-blue-900/60 text-blue-300 hover:text-blue-100 hover:bg-blue-800/80 px-1.5 py-0.5 rounded border border-blue-700/40 hover:border-blue-500/60 transition-all duration-150 underline decoration-dotted underline-offset-2 cursor-pointer"
                            title={`Fly to ${code} in city`}
                        >
                            {code} ↗
                        </button>
                    );
                } else {
                    tokens.push(
                        <code
                            key={tokenIdx++}
                            className="font-mono text-xs bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded border border-gray-700"
                        >
                            {code}
                        </code>
                    );
                }
                remaining = remaining.slice(codeMatch[0].length);
                continue;
            }

            // Bare filename detection: word.ext pattern
            // Matches things like: auth.py parser.ts utils.go README.md
            const fileMatch = remaining.match(/^([a-zA-Z0-9_\-]+\.(py|ts|tsx|js|jsx|go|rs|rb|java|kt|swift|cpp|c|h|php|sh|md|json|yaml|yml))/);
            if (fileMatch) {
                const fname = fileMatch[1];
                const buildingId = fileMap.get(fname.toLowerCase());
                if (buildingId) {
                    tokens.push(
                        <button
                            key={tokenIdx++}
                            onClick={() => onFileClick(buildingId)}
                            className="inline font-mono text-xs text-blue-400 hover:text-blue-300 underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
                            title={`Fly to ${fname} in city`}
                        >
                            {fname}
                        </button>
                    );
                    remaining = remaining.slice(fname.length);
                    continue;
                }
            }

            // Plain text — consume up to next special character
            const plainMatch = remaining.match(/^[^*`a-zA-Z]+|^[a-zA-Z][^*`]*/);
            if (plainMatch) {
                tokens.push(<span key={tokenIdx++}>{plainMatch[0]}</span>);
                remaining = remaining.slice(plainMatch[0].length);
                continue;
            }

            // Fallback: consume one character to avoid infinite loop
            tokens.push(<span key={tokenIdx++}>{remaining[0]}</span>);
            remaining = remaining.slice(1);
        }

        return <span key={lineIdx}>{tokens}</span>;
    };

    const lines = text.split("\n");

    return (
        <div className="text-sm leading-relaxed space-y-1.5">
            {lines.map((line, lineIdx) => {
                // Bullet point
                if (line.match(/^[-*•]\s/)) {
                    return (
                        <div key={lineIdx} className="flex gap-2 items-start">
                            <span className="text-blue-500 mt-0.5 flex-shrink-0">·</span>
                            <span>{renderLine(line.slice(2), lineIdx)}</span>
                        </div>
                    );
                }

                // Numbered list
                const numberedMatch = line.match(/^(\d+)\.\s/);
                if (numberedMatch) {
                    return (
                        <div key={lineIdx} className="flex gap-2 items-start">
                            <span className="text-blue-500 text-xs mt-0.5 flex-shrink-0 font-mono">
                                {numberedMatch[1]}.
                            </span>
                            <span>{renderLine(line.slice(numberedMatch[0].length), lineIdx)}</span>
                        </div>
                    );
                }

                // Empty line
                if (line.trim() === "") {
                    return <div key={lineIdx} className="h-1" />;
                }

                // Normal line
                return <div key={lineIdx}>{renderLine(line, lineIdx)}</div>;
            })}
        </div>
    );
}

interface Message {
    role: "user" | "assistant";
    content: string;
    mentionedIds?: string[];
    timestamp: Date;
}

interface Props {
    data: any;
    onHighlight: (ids: Set<string>) => void;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onFlyTo?: (worldX: number, worldZ: number) => void;
}

export default function AskTheCity({ data, onHighlight, isOpen, onOpen, onClose, onFlyTo }: Props) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: `👋 Hi! I'm CodeCity AI. I know everything about this codebase — its structure, complexity, team discussions, and git history. Ask me anything!`,
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (question: string) => {
        if (!question.trim() || loading || !data) return;

        const userMsg: Message = {
            role: "user",
            content: question,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const resp = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/ask`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        question,
                        buildings: data.buildings,
                        roads: data.roads,
                    }),
                }
            );
            const result = await resp.json();

            const assistantMsg: Message = {
                role: "assistant",
                content: result.answer,
                mentionedIds: result.mentioned_ids,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMsg]);

            // Highlight mentioned buildings in the city
            if (result.mentioned_ids?.length > 0) {
                onHighlight(new Set(result.mentioned_ids));
            }
        } catch {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Sorry, I couldn't reach the AI right now. Try again.",
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => isOpen ? onClose() : onOpen()}
                className={`absolute top-28 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${isOpen
                    ? "bg-blue-900/90 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20"
                    : "bg-gray-900/90 border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
            >
                💬 Ask the City
                {!isOpen && (
                    <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        ?
                    </span>
                )}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="city-panel absolute top-40 right-4 z-30 w-80 bg-gray-900/95 backdrop-blur border border-blue-700/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
                    style={{ height: 'min(420px, calc(100vh - 200px))' }}
                >
                    {/* Header */}
                    <div className="city-panel-header flex items-center justify-between px-4 py-3 bg-blue-900/30 border-b border-blue-700/30 flex-shrink-0">
                        <div>
                            <div className="text-blue-300 font-bold text-sm">💬 Ask the City</div>
                            <div className="text-gray-400 text-xs">
                                {data?.buildings?.length ?? 0} files · powered by Claude
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-2 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                {/* Avatar */}
                                <div
                                    className={`
                                        w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mb-0.5
                                        ${msg.role === "user"
                                            ? "bg-blue-700 text-blue-100"
                                            : "bg-gray-700 text-gray-300 border border-gray-600"
                                        }
                                    `}
                                >
                                    {msg.role === "user" ? (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                            <circle cx="7" cy="4.5" r="2.5" />
                                            <path d="M1.5 13c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" opacity="0.8" />
                                        </svg>
                                    ) : (
                                        /* Simple robot/AI face */
                                        <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                                            <rect x="2" y="4" width="9" height="7" rx="1.5" />
                                            <rect x="4" y="6" width="1.5" height="1.5" rx="0.5" fill="#1e293b" />
                                            <rect x="7.5" y="6" width="1.5" height="1.5" rx="0.5" fill="#1e293b" />
                                            <path d="M5 9.5h3" stroke="#1e293b" strokeWidth="0.8" strokeLinecap="round" />
                                            <rect x="5.75" y="2" width="1.5" height="2.5" rx="0.5" />
                                        </svg>
                                    )}
                                </div>

                                {/* Message bubble */}
                                <div
                                    className={`
                                        max-w-[82%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed
                                        ${msg.role === "user"
                                            ? "bg-blue-600 text-white rounded-br-sm"
                                            : "bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700/50"
                                        }
                                    `}
                                >
                                    {msg.role === "assistant" ? (
                                        <div className="relative group">
                                            <RenderedMessage
                                                text={msg.content}
                                                buildings={data?.buildings ?? []}
                                                onFileClick={(buildingId) => {
                                                    // Highlight + fly to building
                                                    onHighlight(new Set([buildingId]));
                                                    // Find the building position for camera
                                                    const building = data?.buildings.find((b: any) => b.id === buildingId);
                                                    if (building && onFlyTo) {
                                                        onFlyTo(building.position.x, building.position.z);
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded bg-gray-700/0 group-hover:bg-gray-700 text-gray-600 group-hover:text-gray-400 transition-all duration-150 opacity-0 group-hover:opacity-100"
                                                title="Copy response"
                                            >
                                                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
                                                    <rect x="3.5" y="3.5" width="6" height="7" rx="0.8" />
                                                    <path d="M1.5 7.5V1.5h6" strokeLinecap="round" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-sm">{msg.content}</span>
                                    )}

                                    {/* Highlighted buildings badge */}
                                    {msg.role === "assistant" && msg.mentionedIds && msg.mentionedIds.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                            <span className="text-blue-400 text-xs">
                                                {msg.mentionedIds.length} building{msg.mentionedIds.length !== 1 ? "s" : ""} highlighted
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-2 items-end">
                                {/* AI avatar */}
                                <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-300 flex-shrink-0">
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                                        <rect x="2" y="4" width="9" height="7" rx="1.5" />
                                        <rect x="4" y="6" width="1.5" height="1.5" rx="0.5" fill="#1e293b" />
                                        <rect x="7.5" y="6" width="1.5" height="1.5" rx="0.5" fill="#1e293b" />
                                        <path d="M5 9.5h3" stroke="#1e293b" strokeWidth="0.8" strokeLinecap="round" />
                                        <rect x="5.75" y="2" width="1.5" height="2.5" rx="0.5" />
                                    </svg>
                                </div>
                                <div className="bg-gray-800 border border-gray-700/50 rounded-2xl rounded-bl-sm px-4 py-3">
                                    <div className="flex gap-1.5 items-center">
                                        {[0, 150, 300].map(delay => (
                                            <div
                                                key={delay}
                                                className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                                                style={{ animationDelay: `${delay}ms` }}
                                            />
                                        ))}
                                        <span className="text-gray-500 text-xs ml-1">Thinking…</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Suggested questions — collapsed strip after first message */}
                    {(() => {
                        const hasUserMessages = messages.some(m => m.role === "user");
                        const SUGGESTIONS = [
                            "Which files should I look at first as a new developer?",
                            "What is actively being discussed by the team?",
                            "Trace the main data flow through this codebase",
                            "Which files are the biggest risk for bugs?",
                        ];
                        if (!hasUserMessages) {
                            return (
                                <div className="px-3 pb-2 flex-shrink-0">
                                    <p className="text-gray-500 text-xs mb-2 font-medium">Try asking:</p>
                                    <div className="space-y-1.5">
                                        {SUGGESTIONS.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(q)}
                                                className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-all duration-150 border border-transparent hover:border-gray-600 leading-snug"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div className="px-3 pb-1 flex-shrink-0">
                                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {SUGGESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            className="flex-shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2.5 py-1 rounded-full border border-gray-700 hover:border-gray-500 transition-all duration-150 whitespace-nowrap"
                                        >
                                            {q.length > 30 ? q.slice(0, 28) + "…" : q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Input */}
                    <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900">
                        <AIInputWithLoading
                            placeholder="Ask about the codebase..."
                            onSubmit={sendMessage}
                            className="py-2"
                            minHeight={40}
                            maxHeight={120}
                            loadingDuration={0}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
