"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
});

const STAGES = ["download", "parse", "metrics", "ai", "layout"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(true);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);

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
        } catch {}
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
            <CityCanvas data={cityData} />

            {/* Stats bar */}
            <div className="absolute top-4 right-4 z-20 bg-gray-900/80 backdrop-blur border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-4 text-sm text-gray-300">
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
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentStageIdx
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
