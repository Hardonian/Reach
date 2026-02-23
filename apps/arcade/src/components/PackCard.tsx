import { Pack } from "@/lib/packs";
import React from "react";

// Simple map for tool icons
const TOOL_ICONS: Record<string, string> = {
  "console.log": "📝",
  "http.get": "🌐",
  "math.eval": "🧮",
  "fs.read": "📂",
};

interface PackCardProps {
  pack: Pack;
  onClick: () => void;
  isSelected?: boolean;
}

export function PackCard({ pack, onClick, isSelected }: PackCardProps) {
  const difficultyClass =
    {
      easy: "text-difficulty-easy",
      medium: "text-difficulty-medium",
      hard: "text-difficulty-hard",
    }[pack.difficulty] || "text-tertiary";

  // Fallback for older pack data without author
  const author = pack.author || { name: "Community", verified: false };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${pack.name} by ${author.name}, Difficulty: ${pack.difficulty}, Status: ${pack.arcadeSafe ? "Safe" : "Unsafe"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`pack-card ${isSelected ? "selected" : ""}`}
    >
      {/* Decorative background glow for unsafe packs */}
      {!pack.arcadeSafe && <div className="absolute inset-0 unsafe-glow pointer-events-none" />}

      <div className="flex justify-between items-center mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`pack-card-icon ${!pack.arcadeSafe ? "unsafe" : ""}`} aria-hidden="true">
            {pack.arcadeSafe ? "⚡" : "⚠️"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg leading-tight">{pack.name}</h3>
              {author.verified && (
                <span className="badge-verified" title="Verified Author">
                  <span>✓</span> VERIFIED
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 font-mono mt-1 text-xs text-tertiary">
              <span>{pack.duration}</span>
              <span aria-hidden="true">•</span>
              <span className={difficultyClass}>{pack.difficulty.toUpperCase()}</span>
              <span aria-hidden="true">•</span>
              <span className={author.verified ? "text-success" : "text-secondary"}>
                {author.name}
              </span>
            </div>
          </div>
        </div>

        {/* Safety Badge */}
        <span className={`pack-badge ${pack.arcadeSafe ? "safe" : "unsafe"}`}>
          {pack.arcadeSafe ? "SAFE" : "UNSAFE"}
        </span>
      </div>

      <p className="mb-4 relative z-10 text-sm text-secondary line-clamp-2">{pack.description}</p>

      {/* Footer: Tools */}
      <div className="flex items-center justify-between relative z-10">
        <div className="pack-tools" aria-label={`Tools used: ${pack.tools.join(", ") || "None"}`}>
          {pack.tools.map((tool, i) => (
            <div key={i} className="tool-icon" title={tool}>
              {TOOL_ICONS[tool] || "🔧"}
            </div>
          ))}
          {pack.tools.length === 0 && (
            <span className="italic text-xs text-tertiary">No tools declared</span>
          )}
        </div>

        <div className="arrow-icon" aria-hidden="true">
          →
        </div>
      </div>
    </div>
  );
}
