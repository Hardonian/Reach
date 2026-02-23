import { DocLayout } from '@/components/doc-layout'
import { CodeBlock } from '@/components/code-block'

const presetPaths = [
  {
    category: 'Policy',
    description: 'Governance and compliance-focused configurations',
    presets: ['security-basics', 'compliance-minimal', 'audit-ready'],
  },
  {
    category: 'Trust',
    description: 'Evidence and verification configurations',
    presets: ['replay-first-ci', 'drift-hunter', 'evidence-strict'],
  },
  {
    category: 'Decisions',
    description: 'Decision workflow templates',
    presets: ['fast-path', 'full-review', 'automated-gate'],
  },
  {
    category: 'Junctions',
    description: 'Junction rule packs for common patterns',
    presets: ['ci-cd-gates', 'security-checks', 'cost-guards'],
  },
]

export default function PresetsPage() {
  return (
    <DocLayout currentPath="/docs/presets" title="Presets">
      <p className="text-lg text-slate-600 mb-8">
        Choose your starting path. Presets are pre-configured policy packs, templates,
        and junction rules optimized for specific use cases.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Choose Your Path</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">CI/CD Integration</h3>
          <p className="text-slate-600">
            Optimized for automated pipelines. Fast checks, deterministic gates,
            minimal overhead.
          </p>
          <CodeBlock code={`./reach presets apply ci-cd-gates --dry-run`} />
        </div>
        <div className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Security Review</h3>
          <p className="text-slate-600">
            Comprehensive security policy enforcement with evidence requirements
            and audit trails.
          </p>
          <CodeBlock code={`./reach presets apply security-basics --dry-run`} />
        </div>
        <div className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Compliance Audit</h3>
          <p className="text-slate-600">
            Full documentation, retention policies, and compliance-ready
            reporting.
          </p>
          <CodeBlock code={`./reach presets apply audit-ready --dry-run`} />
        </div>
        <div className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Custom Plugin Dev</h3>
          <p className="text-slate-600">
            Starting point for building custom plugins and extensions.
          </p>
          <CodeBlock code={`./reach presets apply plugin-dev --dry-run`} />
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Available Presets</h2>
      <div className="space-y-6">
        {presetPaths.map((category) => (
          <div key={category.category}>
            <h3 className="text-xl font-semibold mb-2">{category.category}</h3>
            <p className="text-slate-600 mb-3">{category.description}</p>
            <ul className="list-disc pl-6 space-y-1">
              {category.presets.map((preset) => (
                <li key={preset}>
                  <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                    {preset}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">List All Presets</h2>
      <CodeBlock code={`./reach presets list`} />

      <h2 className="text-2xl font-semibold mt-8 mb-4">Apply a Preset</h2>
      <CodeBlock
        code={`# Dry run to see what would change
./reach presets apply security-basics --dry-run

# Apply with confirmation
./reach presets apply security-basics --yes`}
      />
      <p className="mt-4 text-slate-600">
        Preset application creates a backup of your current configuration and is
        fully reversible.
      </p>
    </DocLayout>
  )
}
