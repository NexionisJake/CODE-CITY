"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { RippleButton } from "@/components/ui/multi-type-ripple-buttons";
import dynamic from "next/dynamic";

const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
});

const STAGES = ["download", "parse", "metrics", "social", "ai", "layout"];

const EXAMPLE_REPOS = [
  {
    url: "https://github.com/pallets/flask",
    label: "pallets/flask",
    desc: "Python web framework",
    lang: "Python",
    color: "#3b82f6",
    emoji: "🐍",
    stats: "83 files · 12 districts",
  },
  {
    url: "https://github.com/expressjs/express",
    label: "expressjs/express",
    desc: "Node.js web framework",
    lang: "JavaScript",
    color: "#f59e0b",
    emoji: "⚡",
    stats: "64 files · 8 districts",
  },
  {
    url: "https://github.com/zulip/zulip-terminal",
    label: "zulip/zulip-terminal",
    desc: "Terminal Zulip client",
    lang: "Python",
    color: "#10b981",
    emoji: "💬",
    stats: "69 files · 6 districts",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const toastIdRef = useRef(0);

  const addToast = (message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message }]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d.user); })
      .catch(() => { });
  }, []);

  // Show each API warning as an auto-dismissing toast
  useEffect(() => {
    if (cityData?.warnings?.length > 0) {
      cityData.warnings.forEach((warning: string, i: number) => {
        setTimeout(() => addToast(warning), i * 300);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityData]);

  // Keyboard shortcut: N to toggle night mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setNightMode(m => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Night mode CSS class side effect
  useEffect(() => {
    document.body.classList.toggle("night-mode", nightMode);
    return () => document.body.classList.remove("night-mode");
  }, [nightMode]);

  async function handleBuild() {
    setLoading(true);
    setError(null);
    setCityData(null);
    setProgress({ stage: "download", message: "Connecting..." });

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/build-city`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: url }),
        }
      );

      if (!response.ok) {
        // Non-streaming error (e.g. 422)
        let detail = "Server error";
        try {
          const err = await response.json();
          detail = err.detail ?? detail;
        } catch { }
        throw new Error(detail);
      }

      // Read the SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          if (!chunk.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(chunk.slice(6));

            if (payload.stage === "error") {
              throw new Error(payload.message);
            }

            if (payload.stage === "complete") {
              setCityData(payload.data);
              setLoading(false);
              setProgress(null);
              return;
            }

            setProgress({ stage: payload.stage, message: payload.message });
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }

      // If stream ended without a complete event
      if (!cityData) {
        throw new Error("Stream ended unexpectedly");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred");
      setLoading(false);
      setProgress(null);
    }
  }


  // Which stage index we're currently on (for the dots)
  const currentStageIdx = progress ? STAGES.indexOf(progress.stage) : -1;


  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 shrink-0 z-10">
        {/* Brand logo */}
        <div className="flex items-center gap-2 select-none">
          {/* City icon SVG */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="14" width="6" height="12" rx="1" fill="#60a5fa" />
            <rect x="4" y="10" width="2" height="4" rx="0.5" fill="#93c5fd" />
            <rect x="10" y="8" width="8" height="18" rx="1" fill="#3b82f6" />
            <rect x="12" y="4" width="4" height="4" rx="0.5" fill="#60a5fa" />
            <rect x="20" y="11" width="6" height="15" rx="1" fill="#2563eb" />
            <rect x="21" y="7" width="4" height="4" rx="0.5" fill="#60a5fa" />
            {/* Windows */}
            <rect x="11" y="10" width="2" height="2" rx="0.3" fill="#bfdbfe" opacity="0.8" />
            <rect x="14" y="10" width="2" height="2" rx="0.3" fill="#bfdbfe" opacity="0.8" />
            <rect x="11" y="14" width="2" height="2" rx="0.3" fill="#bfdbfe" opacity="0.6" />
            <rect x="14" y="14" width="2" height="2" rx="0.3" fill="#bfdbfe" opacity="0.6" />
          </svg>
          {/* Gradient wordmark */}
          <span
            className="text-xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            CodeCity
          </span>
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && url && handleBuild()}
          disabled={loading}
          placeholder="https://github.com/owner/repo"
          className="flex-1 max-w-xl bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 disabled:opacity-50"
        />
        <RippleButton
          variant="default"
          onClick={handleBuild}
          disabled={loading || !url.trim()}
          className={loading ? 'bg-blue-700 text-blue-200 cursor-wait' : ''}
        >
          {loading ? (
            <>
              {/* Spinner SVG */}
              <svg
                className="animate-spin"
                width="14" height="14" viewBox="0 0 14 14" fill="none"
              >
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Building...
            </>
          ) : (
            <>
              {/* City icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity="0.9">
                <rect x="0" y="7" width="3" height="7" rx="0.5" />
                <rect x="5" y="4" width="4" height="10" rx="0.5" />
                <rect x="11" y="5" width="3" height="9" rx="0.5" />
              </svg>
              Build City
            </>
          )}
        </RippleButton>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <img src={user.avatar_url} className="w-7 h-7 rounded-full" />
              <span className="text-gray-300 text-sm">{user.login}</span>
              <button
                onClick={() => fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                  method: "POST", credentials: "include"
                }).then(() => setUser(null))}
                className="text-gray-500 text-xs hover:text-white"
              >Sign out</button>
            </div>
          ) : (
            <RippleButton
              variant="ghost"
              onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/github`}
              className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-3 py-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Sign in
            </RippleButton>
          )}
        </div>

      </header>

      {/* Error banner — full width, below header */}
      {error && !loading && (
        <div
          className="absolute top-14 left-0 right-0 z-40 mx-4 mt-2 animate-fade-in"
        >
          <div className="bg-red-950/90 backdrop-blur border border-red-700/60 rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg shadow-red-900/20">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="8" stroke="#f87171" strokeWidth="1.5" />
                <path d="M9 5v5M9 13v.5" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <div className="text-red-300 font-medium text-sm">Failed to build city</div>
              <div className="text-red-400/80 text-xs mt-0.5 break-words">{error}</div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleBuild}
                className="text-xs bg-red-800 hover:bg-red-700 text-red-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-800/60 text-red-500 hover:text-red-300 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 relative">
        {cityData ? (
          <>
            <CityCanvas
              data={cityData}
              nightMode={nightMode}
              onNightModeToggle={() => setNightMode(n => !n)}
            />
          </>

        ) : (
          <div className="flex items-center justify-center h-full bg-gray-950 relative">
            {!cityData && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">

                {/* Tagline */}
                <div className="text-center mb-10 animate-fade-in pointer-events-none">
                  <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                    Transform any GitHub repository into an{" "}
                    <span className="text-blue-400 font-medium">interactive 3D city</span>.
                    Explore architecture, complexity, and team activity at a glance.
                  </p>
                </div>

                {/* How It Works — 3 steps */}
                <div
                  className="flex items-start gap-8 mb-10 pointer-events-none"
                  style={{ animation: 'fadeIn 0.5s ease-out 0.05s both' }}
                >
                  {[
                    {
                      icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                      ),
                      step: "01",
                      title: "Paste a GitHub URL",
                      desc: "Any public repository. We clone and analyse it instantly.",
                    },
                    {
                      icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      ),
                      step: "02",
                      title: "City Builds Instantly",
                      desc: "Files become buildings. Imports become roads. Complexity becomes colour.",
                    },
                    {
                      icon: (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                      ),
                      step: "03",
                      title: "Explore & Ask",
                      desc: "Click buildings for AI insights. Ask questions. Run guided tours.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center text-center gap-3 max-w-[160px]"
                      style={{ animation: `fadeIn 0.4s ease-out ${0.1 + i * 0.1}s both` }}
                    >
                      {/* Step icon circle */}
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center text-blue-400">
                          {item.icon}
                        </div>
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{i + 1}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-white text-sm font-semibold mb-1">{item.title}</div>
                        <div className="text-gray-500 text-xs leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Example repo cards */}
                <div
                  className="relative flex gap-3 mb-10 pointer-events-auto"
                  style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}
                >
                  <p className="absolute -top-6 left-0 right-0 text-center text-gray-500 text-sm">
                    Try an example:
                  </p>
                  {EXAMPLE_REPOS.map((repo, i) => (
                    <button
                      key={repo.url}
                      onClick={() => { setUrl(repo.url); }}
                      className="group flex flex-col gap-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl px-4 py-3 text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-lg"
                      style={{
                        animation: `slideUp 0.4s ease-out ${0.15 + i * 0.08}s both`,
                        minWidth: 160,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{repo.emoji}</span>
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: repo.color }}
                        >
                          {repo.lang}
                        </span>
                      </div>
                      <div className="text-white text-sm font-medium">{repo.label}</div>
                      <div className="text-gray-500 text-xs">{repo.desc}</div>
                      <div className="text-gray-600 text-xs mt-1">{repo.stats}</div>
                      <div
                        className="mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: repo.color }}
                      >
                        Click to load →
                      </div>
                    </button>
                  ))}
                </div>

                {/* Arrow pointing up to URL bar */}
                <div
                  className="flex flex-col items-center gap-2 pointer-events-none"
                  style={{ animation: 'fadeIn 0.5s ease-out 0.4s both' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-gray-600 animate-bounce">
                    <path d="M10 3L10 17M10 3L5 8M10 3L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-gray-600 text-sm">or paste any GitHub URL above</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress overlay */}
        {loading && progress && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-950/92 backdrop-blur-sm">

            {/* Animated skyline */}
            <div className="flex items-end gap-1.5 mb-8" style={{ height: 56 }}>
              {[14, 28, 20, 40, 24, 36, 18, 44, 22, 32, 16, 38].map((h, i) => (
                <div
                  key={i}
                  className="rounded-t-sm"
                  style={{
                    width: 10,
                    height: h,
                    background: `linear-gradient(to top, #3b82f6, #60a5fa${Math.round(40 + i * 10).toString(16)})`,
                    animation: `pulse 1.4s ease-in-out ${i * 0.1}s infinite alternate`,
                    opacity: 0.5 + (i % 4) * 0.15,
                  }}
                />
              ))}
            </div>

            {/* Stage message */}
            <div className="text-center mb-6">
              <p className="text-white text-base font-medium mb-1.5 animate-fade-in" key={progress.stage}>
                {progress.message}
              </p>
              <p className="text-gray-500 text-sm font-mono">
                {url.split("/").slice(-2).join("/")}
              </p>
            </div>

            {/* Stage progress — dots WITH labels */}
            {(() => {
              const stages = [
                { id: "download", label: "Download" },
                { id: "parse", label: "Parse" },
                { id: "metrics", label: "Metrics" },
                { id: "social", label: "Social" },
                { id: "ai", label: "AI" },
                { id: "layout", label: "Layout" },
              ];
              const currentIdx = stages.findIndex(s => s.id === progress.stage);

              return (
                <div className="flex items-start gap-1">
                  {stages.map((stage, i) => (
                    <div key={stage.id} className="flex flex-col items-center gap-1.5" style={{ minWidth: 52 }}>
                      {/* Connector line + dot */}
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div className={`flex-1 h-px transition-colors duration-500 ${i <= currentIdx ? 'bg-blue-500' : 'bg-gray-700'
                            }`} />
                        )}
                        {/* Dot */}
                        <div className={`
                          w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-500
                          ${i < currentIdx ? 'bg-green-400 scale-100' :
                            i === currentIdx ? 'bg-blue-400 scale-125 shadow-lg shadow-blue-400/50 animate-pulse' :
                              'bg-gray-600 scale-100'}
                        `} />
                        {i < stages.length - 1 && (
                          <div className={`flex-1 h-px transition-colors duration-500 ${i < currentIdx ? 'bg-blue-500' : 'bg-gray-700'
                            }`} />
                        )}
                      </div>
                      {/* Label */}
                      <span className={`text-xs transition-colors duration-300 text-center ${i < currentIdx ? 'text-green-500' :
                        i === currentIdx ? 'text-blue-400 font-medium' :
                          'text-gray-600'
                        }`}>
                        {i < currentIdx ? '✓' : stage.label}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Elapsed time hint */}
            <p className="text-gray-600 text-xs mt-6">
              Large repos may take 20–30 seconds
            </p>
          </div>
        )}

        {/* Toast notifications */}
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 340 }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="flex items-start gap-3 bg-amber-950/90 backdrop-blur border border-amber-700/50 rounded-xl px-4 py-3 shadow-lg pointer-events-auto animate-fade-in"
            >
              <span className="text-amber-400 text-base flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-amber-200 text-xs leading-relaxed flex-1">{toast.message}</p>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-amber-600 hover:text-amber-300 transition-colors flex-shrink-0 text-lg leading-none -mt-0.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
