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
      className="city-panel absolute bottom-6 left-6 z-20 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl w-80 text-white shadow-2xl animate-fade-in"
      style={{
        borderLeft: `4px solid rgb(${color.r},${color.g},${color.b})`,
        animationDuration: '0.2s',
      }}
    >
      {/* Header */}
      <div className="relative px-4 pt-3 pb-2">
        {/* File path — directory dimmed, filename bold */}
        <div className="pr-8 mb-2">
          {(() => {
            const parts = (file_path || building.id || '').replace(/\\/g, '/').split('/');
            const filename = parts.pop() || '';
            const dir = parts.join('/');
            return (
              <div>
                {dir && (
                  <div className="text-gray-500 text-xs font-mono truncate mb-0.5" title={dir}>
                    {dir}/
                  </div>
                )}
                <div className="text-white text-sm font-semibold font-mono truncate" title={filename}>
                  {filename}
                </div>
              </div>
            );
          })()}
        </div>
        <p className="text-gray-400 text-xs">{archetypeLabel}</p>

        {/* Close button — pill style */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-600 text-gray-400 hover:text-white transition-all duration-150 text-base leading-none flex-shrink-0"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Hotspot badge */}
      {metadata.is_hotspot && (
        <div className="mx-4 mb-2 bg-red-900/60 border border-red-700 text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg">
          🔴 HOTSPOT — Refactor Recommended
        </div>
      )}

      {/* AI Summary */}
      {metadata.ai_summary && metadata.ai_summary !== "No AI summary available." && (
        <div className="mx-4 mb-3 mt-1 pt-2 border-t border-gray-700/50">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs">🤖</span>
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">AI Summary</span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed border-l-2 border-blue-500/40 pl-2.5">
            {metadata.ai_summary}
          </p>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-700/50 border-t border-gray-700">
        <MetricCell label="Language" value={metadata.language.toUpperCase()} />
        <MetricCell label="Lines of Code" value={metadata.loc.toLocaleString()} />
        <MetricCell label="Functions" value={metadata.function_count} />
        <MetricCell label="Complexity" value={`${complexityLabel} (${complexity})`} />
      </div>

      {/* Social Discussions Section */}
      {metadata.social?.message_count > 0 && (
        <div className="mt-3 pt-3 border-t border-orange-900/40 rounded-b-xl bg-orange-950/20 p-2.5">

          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-sm">💬</span>
            <span className="text-orange-400 text-xs font-bold tracking-wider uppercase">
              Team Discussions
            </span>
            <span className="ml-auto bg-orange-900/50 text-orange-300 text-xs px-1.5 py-0.5 rounded-full font-medium">
              {metadata.social.message_count}
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {metadata.social.recent_messages?.slice(0, 3).map((msg: any, i: number) => (
              <div
                key={i}
                className={`pb-2 ${i < Math.min(metadata.social.recent_messages.length, 3) - 1 ? 'border-b border-white/5' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-orange-300 text-xs font-semibold truncate max-w-[100px]">
                    @{msg.user}
                  </span>
                  <span className="text-gray-600 text-xs flex-shrink-0 ml-1">{msg.channel}</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed line-clamp-2">
                  {msg.text}
                </p>
                {msg.reactions?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {msg.reactions.map((r: string, ri: number) => (
                      <span key={ri} className="text-xs">{r}</span>
                    ))}
                  </div>
                )}
                <span className="text-gray-600 text-xs mt-0.5 block">{msg.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Heat bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(metadata.social.heat_score / 10) * 100}%`,
                  background: 'linear-gradient(to right, #f97316, #ef4444)',
                }}
              />
            </div>
            <span className="text-orange-500 text-xs whitespace-nowrap">
              {metadata.social.heat_score?.toFixed(1)}/10
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
