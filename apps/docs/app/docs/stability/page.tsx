import { DocLayout } from "@/components/doc-layout";

const stabilityLevels = [
  {
    level: "Stable",
    description:
      "Production-ready. Breaking changes only in major versions with migration path.",
    items: [
      "Core Rust deterministic evaluate loop",
      "Transcript hashing and verification",
      "Export bundle format",
      "Replay semantics",
    ],
  },
  {
    level: "Beta",
    description:
      "Feature-complete but may have API changes. Suitable for production with awareness.",
    items: [
      "TypeScript SDK APIs",
      "Plugin system (v1)",
      "CLI command structure",
      "Web interface",
    ],
  },
  {
    level: "Experimental",
    description: "Early access. APIs may change significantly or be removed.",
    items: [
      "Advanced metrics collection",
      "Federation features",
      "Custom decision types",
      "Real-time collaboration",
    ],
  },
];

export default function StabilityPage() {
  return (
    <DocLayout currentPath="/docs/stability" title="Stability & Roadmap">
      <p className="text-lg text-slate-600 mb-8">
        Reach is currently in <strong>Beta (0.3.x)</strong>. This page documents
        what's stable, what's experimental, and our versioning policy.
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-blue-800">
          <strong>Version:</strong> 0.3.1 | <strong>Status:</strong> Beta |{" "}
          <strong>Target 1.0:</strong> Q2 2025
        </p>
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Stability Levels</h2>
      <div className="space-y-6">
        {stabilityLevels.map((level) => (
          <div key={level.level} className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-2">{level.level}</h3>
            <p className="text-slate-600 mb-4">{level.description}</p>
            <ul className="list-disc pl-6 space-y-1">
              {level.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Versioning Policy</h2>
      <p className="mb-4">
        Reach follows semantic versioning with stability annotations:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>0.x.y (Pre-1.0):</strong> APIs may evolve. Minor versions may
          add features; patch versions fix bugs.
        </li>
        <li>
          <strong>Post-1.0:</strong> Standard SemVer. Major = breaking changes
          (with migrations), Minor = features, Patch = fixes.
        </li>
        <li>
          <strong>Breaking changes:</strong> Always documented with migration
          guides in CHANGELOG.md.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Schema Stability</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Schema</th>
            <th className="text-left py-2">Status</th>
            <th className="text-left py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">Transcript format</td>
            <td className="py-2">
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">
                Stable
              </span>
            </td>
            <td className="py-2">Hash-compatible since 0.1.0</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Export bundle</td>
            <td className="py-2">
              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">
                Stable
              </span>
            </td>
            <td className="py-2">Format v1, backward compatible</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Plugin manifest</td>
            <td className="py-2">
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-sm">
                Beta
              </span>
            </td>
            <td className="py-2">May extend for v2 capabilities</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">Preset format</td>
            <td className="py-2">
              <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-sm">
                Beta
              </span>
            </td>
            <td className="py-2">Under active development</td>
          </tr>
        </tbody>
      </table>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Migration Guides</h2>
      <p className="mb-4">
        When breaking changes occur, we provide migration tools:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Automated migration scripts where possible</li>
        <li>Detailed CHANGELOG entries with before/after examples</li>
        <li>Deprecation warnings in preceding versions</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Roadmap</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>0.4.x:</strong> Plugin registry, enhanced metrics
        </li>
        <li>
          <strong>0.5.x:</strong> Federation improvements, UI polish
        </li>
        <li>
          <strong>0.6.x:</strong> Performance optimizations, scale testing
        </li>
        <li>
          <strong>1.0.0:</strong> Stable API freeze, LTS commitment
        </li>
      </ul>
    </DocLayout>
  );
}
