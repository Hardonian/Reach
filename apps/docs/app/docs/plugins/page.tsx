import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

const capabilities = [
  { name: "registerAnalyzePrAnalyzer", description: "Analyze PRs/decisions" },
  { name: "registerDecisionType", description: "Add custom decision types" },
  { name: "registerPolicy", description: "Register custom policies" },
  {
    name: "registerEvidenceExtractor",
    description: "Extract evidence from sources",
  },
  { name: "registerRenderer", description: "Format output" },
  { name: "registerRetriever", description: "Fetch external data" },
];

const cookbookRecipes = [
  {
    id: "a",
    title: "Add a Deterministic Check",
    description: "Create custom validation logic",
  },
  {
    id: "b",
    title: "Add a New Junction Template",
    description: "Reusable decision templates",
  },
  {
    id: "c",
    title: "Add an Evidence Metadata Enricher",
    description: "Augment evidence with context",
  },
  {
    id: "d",
    title: "Add an Export Bundle Augmentor",
    description: "Extend export formats",
  },
  {
    id: "e",
    title: "Add a Policy Validator Hook",
    description: "Custom policy enforcement",
  },
  {
    id: "f",
    title: "Add a Metrics Contributor",
    description: "Custom telemetry and metrics",
  },
  {
    id: "g",
    title: "Add a Safe CLI Extension",
    description: "New CLI commands",
  },
  {
    id: "h",
    title: "Add a Formatter/Serializer",
    description: "Custom output formats",
  },
];

export default function PluginsPage() {
  return (
    <DocLayout currentPath="/docs/plugins" title="Plugins">
      <p className="text-lg text-slate-600 mb-8">
        Extend Reach with custom plugins. Plugins can add analyzers, extractors, renderers, and new
        decision types—all while maintaining determinism guarantees.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Quick Start: Scaffold a Plugin</h2>
      <CodeBlock code={`./reach plugins scaffold my-plugin`} />
      <p className="mt-4">
        This creates a new plugin in <code>plugins/my-plugin/</code> with the basic structure and a
        sample implementation.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Plugin Structure</h2>
      <CodeBlock
        code={`plugins/my-plugin/
├── plugin.json      # Plugin manifest
├── index.js         # Entry point
└── README.md        # Documentation`}
      />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Capabilities</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Capability</th>
            <th className="text-left py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {capabilities.map((cap) => (
            <tr key={cap.name} className="border-b">
              <td className="py-2">
                <code className="bg-slate-100 px-2 py-1 rounded text-sm">{cap.name}</code>
              </td>
              <td className="py-2">{cap.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Determinism Requirements</h2>
      <p className="mb-4">Plugins used in replay must be deterministic. Follow these rules:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Same input → same output</li>
        <li>
          No <code>Math.random()</code> without seed
        </li>
        <li>
          No <code>Date.now()</code> in output paths
        </li>
        <li>Sort map keys before iteration</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Cookbook</h2>
      <p className="mb-4">Step-by-step recipes for common plugin patterns:</p>
      <div className="grid md:grid-cols-2 gap-4">
        {cookbookRecipes.map((recipe) => (
          <div key={recipe.id} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                {recipe.id})
              </span>
              <h3 className="font-semibold">{recipe.title}</h3>
            </div>
            <p className="text-slate-600 text-sm">{recipe.description}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Validate a Plugin</h2>
      <CodeBlock code={`./reach plugins validate plugins/my-plugin`} />

      <h2 className="text-2xl font-semibold mt-8 mb-4">List Installed Plugins</h2>
      <CodeBlock code={`./reach plugins list`} />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Sample Plugins</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <code>evidence-enricher</code> — Adds metadata to evidence items
        </li>
        <li>
          <code>export-postprocessor</code> — Transforms export bundles
        </li>
        <li>
          <code>junction-rule-pack</code> — Collection of reusable junction rules
        </li>
      </ul>
    </DocLayout>
  );
}
