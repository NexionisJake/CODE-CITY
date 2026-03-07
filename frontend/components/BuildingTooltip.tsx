"use client";

import { getArchetype } from "@/lib/buildingRegistry";

interface BuildingTooltipProps {
  building: any;
  onClose: () => void;
}

export default function BuildingTooltip({
  building,
  onClose,
}: BuildingTooltipProps) {
  const { metadata, file_path, color } = building;
  const complexity = metadata.complexity;

  const archetype = getArchetype(metadata.loc);
  const archetypeLabel = {
    house: "🏠 House",
    apartment: "🏢 Apartment",
    tower: "🏬 Tower",
    skyscraper: "🏙 Skyscraper",
  }[archetype];

  const complexityLabel =
    complexity <= 2 ? "🟢 Pristine" :
      complexity <= 5 ? "🟢 Healthy" :
        complexity <= 8 ? "🟡 Moderate" :
          complexity <= 11 ? "🟠 Elevated" :
            complexity <= 15 ? "🔴 Concerning" :
              complexity <= 20 ? "🔴 Critical" : "🔴 Toxic";

  return (
    <div
      className="absolute bottom-6 left-6 z-20 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl w-80 text-white shadow-2xl"
      style={{ borderLeft: `4px solid rgb(${color.r},${color.g},${color.b})` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="pr-2">
          <p className="font-mono text-blue-400 text-sm break-all">
            {file_path}
          </p>
          <p className="text-gray-400 text-xs mb-2">{archetypeLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-lg leading-none shrink-0"
        >
          &times;
        </button>
      </div>

      {/* Hotspot badge */}
      {metadata.is_hotspot && (
        <div className="mx-4 mb-2 bg-red-900/60 border border-red-700 text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg">
          🔴 HOTSPOT — Refactor Recommended
        </div>
      )}

      {/* AI Summary */}
      {metadata.ai_summary && (
        <p className="px-4 pb-3 text-gray-300 text-sm italic">
          {metadata.ai_summary}
        </p>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-700/50 border-t border-gray-700">
        <MetricCell label="Language" value={metadata.language.toUpperCase()} />
        <MetricCell label="Lines of Code" value={metadata.loc.toLocaleString()} />
        <MetricCell label="Functions" value={metadata.function_count} />
        <MetricCell label="Complexity" value={`${complexityLabel} (${complexity})`} />
      </div>

      {/* Social discussions section */}
      {metadata.social?.message_count > 0 && (
        <div style={{
          marginTop: 0,
          paddingTop: 10,
          borderTop: "1px solid rgba(255,100,0,0.3)",
          background: "rgba(255,80,0,0.08)",
          borderRadius: "0 0 12px 12px",
          padding: "8px 10px",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ color: "#ff8844", fontSize: 11, fontWeight: "bold", letterSpacing: "0.05em" }}>
              TEAM DISCUSSIONS ({metadata.social.message_count} messages)
            </span>
          </div>

          {/* Recent messages */}
          {metadata.social.recent_messages.map((msg: any, i: number) => (
            <div key={i} style={{
              marginBottom: 8,
              paddingBottom: 8,
              borderBottom: i < metadata.social.recent_messages.length - 1
                ? "1px solid rgba(255,255,255,0.06)" : "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "#ff9966", fontSize: 10, fontWeight: "bold" }}>
                  @{msg.user}
                </span>
                <span style={{ color: "#666", fontSize: 10 }}>{msg.channel}</span>
              </div>
              <div style={{ color: "#ddd", fontSize: 11, lineHeight: 1.4 }}>
                {msg.text.length > 80 ? msg.text.slice(0, 80) + "…" : msg.text}
              </div>
              {msg.reactions?.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {msg.reactions.join(" ")}
                </div>
              )}
              <div style={{ color: "#555", fontSize: 10, marginTop: 2 }}>{msg.timestamp}</div>
            </div>
          ))}

          {/* Heat indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <div style={{
              width: `${metadata.social.heat_score * 10}%`,
              height: 3,
              background: "linear-gradient(to right, #ff8800, #ff2200)",
              borderRadius: 2,
              transition: "width 0.3s",
            }} />
            <span style={{ color: "#ff6633", fontSize: 10 }}>
              Heat: {metadata.social.heat_score.toFixed(1)}/10
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900/80 px-4 py-2">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}
