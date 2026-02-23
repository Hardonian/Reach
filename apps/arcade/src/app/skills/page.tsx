"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getAllSkills, getToolsForSkill, skillToMCPConfig } from "@/lib/runtime";
import type { SkillManifest } from "@/lib/runtime";

const TAG_COLORS: Record<string, string> = {
  beginner: "text-emerald-400 bg-emerald-950/40",
  intermediate: "text-yellow-400 bg-yellow-950/40",
  advanced: "text-red-400 bg-red-950/40",
};

export default function SkillsPage() {
  const skills = getAllSkills();
  const [selectedSkill, setSelectedSkill] = useState<SkillManifest | null>(null);
  const [showMCP, setShowMCP] = useState(false);

  return (
    <div className="section-container py-12">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-bold mb-3">Skills</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Composable units of agent behavior. Each skill declares inputs, tools, and evaluation
          hooks.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Skill List */}
        <div className="lg:col-span-2 space-y-4">
          {skills.map((skill) => {
            const tools = getToolsForSkill(skill.id);
            const isSelected = selectedSkill?.id === skill.id;
            return (
              <button
                key={skill.id}
                onClick={() => {
                  setSelectedSkill(skill);
                  setShowMCP(false);
                }}
                className={`w-full text-left card transition-all ${
                  isSelected ? "border-accent bg-accent/5" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <h3 className="font-bold">{skill.name}</h3>
                      <span className="text-xs text-gray-500">v{skill.version}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {skill.tags
                      .filter((t) => TAG_COLORS[t])
                      .map((t) => (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[t]}`}
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-3">{skill.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    {skill.inputs.length} input
                    {skill.inputs.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {tools.length} tool{tools.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    {skill.evaluationHooks.length} eval hook
                    {skill.evaluationHooks.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div>
          {selectedSkill ? (
            <div className="card sticky top-24">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{selectedSkill.icon}</span>
                <div>
                  <h2 className="font-bold text-lg">{selectedSkill.name}</h2>
                  <span className="text-xs text-gray-500">v{selectedSkill.version}</span>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">{selectedSkill.description}</p>

              {/* Inputs */}
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Inputs</h3>
                <div className="space-y-2">
                  {selectedSkill.inputs.map((input) => (
                    <div key={input.name} className="p-2 rounded bg-black/20 border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs text-accent font-mono">{input.name}</code>
                        <span className="text-xs text-gray-600">{input.type}</span>
                        {input.required && <span className="text-xs text-red-400">required</span>}
                      </div>
                      <p className="text-xs text-gray-500">{input.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="mb-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Tools</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedSkill.tools.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-1 rounded bg-surface border border-border font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Model Hints */}
              {selectedSkill.modelHints.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Model Hints
                  </h3>
                  {selectedSkill.modelHints.map((h, i) => (
                    <div key={i} className="text-xs text-gray-400">
                      {h.provider}/{h.model} — {h.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Eval Hooks */}
              {selectedSkill.evaluationHooks.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Evaluation Hooks
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.evaluationHooks.map((h) => (
                      <span
                        key={h}
                        className="text-xs px-2 py-1 rounded bg-emerald-950/30 text-emerald-400 font-mono"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Link
                  href={`${ROUTES.PLAYGROUND}?skill=${selectedSkill.id}`}
                  className="btn-primary text-sm text-center"
                >
                  Run in Playground
                </Link>
                <button onClick={() => setShowMCP(!showMCP)} className="btn-secondary text-sm">
                  {showMCP ? "Hide" : "Export"} MCP Config
                </button>
              </div>

              {/* MCP Export */}
              {showMCP && (
                <div className="mt-4 p-3 rounded bg-black/30 border border-white/5 overflow-x-auto">
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre">
                    {JSON.stringify(skillToMCPConfig(selectedSkill), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">🧩</div>
              <h3 className="font-bold mb-1">Select a Skill</h3>
              <p className="text-sm text-gray-500">Click a skill to view its manifest and tools.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
