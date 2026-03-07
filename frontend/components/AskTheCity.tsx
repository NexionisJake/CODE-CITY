"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
    mentionedIds?: string[];
    timestamp: Date;
}

interface Props {
    data: any;
    onHighlight: (ids: Set<string>) => void;
}

const SUGGESTED_QUESTIONS = [
    "Which files should I look at first as a new developer?",
    "Why does the most complex file exist?",
    "What is actively being discussed by the team?",
    "Trace the main data flow through this codebase",
    "Which files are the biggest risk for bugs?",
];

export default function AskTheCity({ data, onHighlight }: Props) {
    const [open, setOpen] = useState(false);
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
        } catch (e) {
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
                onClick={() => setOpen(o => !o)}
                className={`absolute top-28 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${open
                        ? "bg-blue-900/90 border-blue-500 text-blue-300 shadow-lg shadow-blue-500/20"
                        : "bg-gray-900/90 border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
            >
                💬 Ask the City
                {!open && (
                    <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        ?
                    </span>
                )}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="absolute top-40 right-4 z-20 w-80 bg-gray-900/97 backdrop-blur border border-blue-700/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ height: 420 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-900/30 border-b border-blue-700/30 flex-shrink-0">
                        <div>
                            <div className="text-blue-300 font-bold text-sm">💬 Ask the City</div>
                            <div className="text-gray-400 text-xs">
                                {data?.buildings?.length ?? 0} files · powered by Claude
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg">×</button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${msg.role === "user"
                                        ? "bg-blue-700 text-white rounded-br-sm"
                                        : "bg-gray-800 text-gray-200 rounded-bl-sm"
                                    }`}>
                                    {msg.content}
                                    {msg.mentionedIds && msg.mentionedIds.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-700">
                                            <span className="text-xs text-blue-400">
                                                🏢 Highlighted {msg.mentionedIds.length} building{msg.mentionedIds.length !== 1 ? "s" : ""} in city
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 rounded-xl rounded-bl-sm px-3 py-2">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Suggested questions (shown when no user messages yet) */}
                    {messages.filter(m => m.role === "user").length === 0 && (
                        <div className="px-3 pb-2 flex-shrink-0">
                            <div className="text-gray-500 text-xs mb-1.5">Try asking:</div>
                            <div className="flex flex-wrap gap-1">
                                {SUGGESTED_QUESTIONS.slice(0, 3).map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(q)}
                                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-lg transition"
                                    >
                                        {q.length > 36 ? q.slice(0, 35) + "…" : q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-3 pb-3 flex-shrink-0 border-t border-gray-800 pt-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && sendMessage(input)}
                                placeholder="Ask about the codebase..."
                                disabled={loading || !data}
                                className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-blue-500 placeholder-gray-500 disabled:opacity-50"
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={loading || !input.trim() || !data}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-lg px-3 py-2 text-sm transition"
                            >
                                →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
