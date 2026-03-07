"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
});

const STAGES = ["download", "parse", "metrics", "social", "ai", "layout"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(true);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d.user); })
      .catch(() => { });
  }, []);

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

  async function handleBuild() {
    setLoading(true);
    setError(null);
    setCityData(null);
    setShowWarnings(true);
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

  const hotspotCount =
    cityData?.buildings?.filter((b: any) => b.metadata?.is_hotspot).length ?? 0;
  const discussedCount =
    cityData?.buildings?.filter((b: any) => b.metadata?.social?.message_count > 0).length ?? 0;

  // Which stage index we're currently on (for the dots)
  const currentStageIdx = progress ? STAGES.indexOf(progress.stage) : -1;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 shrink-0 z-10">
        <h1 className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
          CodeCity
        </h1>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && url && handleBuild()}
          disabled={loading}
          placeholder="https://github.com/owner/repo"
          className="flex-1 max-w-xl bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-500 disabled:opacity-50"
        />
        <button
          onClick={handleBuild}
          disabled={loading || !url}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {loading ? "Building..." : "Build City"}
        </button>
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
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/auth/github`}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-600 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Sign in
            </a>
          )}
        </div>
        {error && (
          <span className="text-red-400 text-sm truncate max-w-sm">
            {error}
          </span>
        )}
      </header>

      {/* Warnings banner */}
      {cityData?.warnings?.length > 0 && showWarnings && (
        <div className="bg-yellow-900/60 border border-yellow-700 text-yellow-200 text-sm px-4 py-2 flex items-start gap-3 shrink-0 z-10">
          <div className="flex-1">
            <ul className="list-disc list-inside space-y-0.5">
              {cityData.warnings.map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setShowWarnings(false)}
            className="text-yellow-400 hover:text-yellow-100 text-lg leading-none shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 relative">
        {cityData ? (
          <>
            <CityCanvas data={cityData} nightMode={nightMode} />

            {/* Stats bar + Night mode toggle */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
              <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-4 text-sm text-gray-300">
                <span>
                  <span className="text-white font-medium">
                    {cityData.buildings.length}
                  </span>{" "}
                  files
                </span>
                <span className="text-gray-600">|</span>
                <span>
                  <span className="text-white font-medium">
                    {cityData.roads.length}
                  </span>{" "}
                  connections
                </span>
                <span className="text-gray-600">|</span>
                <span>
                  <span
                    className={`font-medium ${hotspotCount > 0 ? "text-red-400" : "text-white"}`}
                  >
                    {hotspotCount}
                  </span>{" "}
                  hotspots
                </span>
                {discussedCount > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>
                      <span className="font-medium" style={{ color: "#ff8844" }}>
                        💬 {discussedCount}
                      </span>{" "}
                      discussed
                    </span>
                  </>
                )}
              </div>

              {/* Night mode toggle */}
              <button
                onClick={() => setNightMode(n => !n)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-300 ${nightMode
                  ? "bg-indigo-950 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/20"
                  : "bg-gray-900/90 border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                title={`${nightMode ? "Switch to Day Mode" : "Switch to Night Mode"} (N)`}
              >
                {nightMode ? "\u2600\uFE0F Day" : "\uD83C\uDF19 Night"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-950">
            {!loading && (
              <p className="text-gray-500 text-lg">
                Enter a GitHub URL to visualise it as a 3D city
              </p>
            )}
          </div>
        )}

        {/* Progress overlay */}
        {loading && progress && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur">
            {/* Animated skyline */}
            <div className="flex items-end gap-1 mb-6" style={{ height: 48 }}>
              {[18, 32, 24, 40, 28, 36, 20, 44, 26, 38].map((h, i) => (
                <div
                  key={i}
                  className="w-3 bg-blue-400 rounded-t"
                  style={{
                    height: h,
                    opacity: 0.4 + (i % 3) * 0.2,
                    animation: `pulse 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                  }}
                />
              ))}
            </div>

            {/* Stage message */}
            <p className="text-white text-base font-medium mb-2">{progress.message}</p>
            <p className="text-gray-500 text-xs">
              {url.split("/").slice(-2).join("/")}
            </p>

            {/* Stage dots */}
            <div className="flex gap-3 mt-4">
              {STAGES.map((stage, i) => (
                <div
                  key={stage}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentStageIdx
                    ? "bg-blue-400 scale-125"
                    : i < currentStageIdx
                      ? "bg-blue-600"
                      : "bg-gray-600"
                    }`}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
