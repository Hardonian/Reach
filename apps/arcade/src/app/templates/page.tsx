import Link from 'next/link';
import { TEMPLATES } from '@/lib/templates';
import { ROUTES } from '@/lib/routes';

const CATEGORY_LABELS: Record<string, string> = {
  readiness: 'Readiness',
  safety: 'Safety',
  regression: 'Change detection',
  tracing: 'Tracing',
  release: 'Release gates',
};

const DIFFICULTY_COLORS = {
  beginner: 'text-emerald-400 bg-emerald-950/40',
  intermediate: 'text-yellow-400 bg-yellow-950/40',
  advanced: 'text-red-400 bg-red-950/40',
};

export const metadata = {
  title: 'Templates — ReadyLayer',
  description: 'Start from a working baseline. Pick a template, click Use template, and see results instantly.',
};

export default function TemplatesPage() {
  return (
    <div className="section-container py-12">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Templates</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Start from a working baseline. Each template runs instantly in the playground — no setup.
        </p>
      </div>

      {/* Template grid */}
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map((template) => (
            <div key={template.id} className="card hover:border-accent/50 transition-all flex flex-col">
              {/* Icon + badges */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{template.icon}</div>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[template.difficulty]}`}>
                    {template.difficulty}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-gray-400">
                    {CATEGORY_LABELS[template.category]}
                  </span>
                </div>
              </div>

              {/* Name + tagline */}
              <h3 className="font-bold mb-1">{template.name}</h3>
              <p className="text-sm text-gray-400 mb-3 flex-1">{template.tagline}</p>

              {/* Checks preview */}
              {template.checks.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Checks included</div>
                  <ul className="space-y-1">
                    {template.checks.slice(0, 3).map((check) => (
                      <li key={check} className="text-xs text-gray-400 flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        {check}
                      </li>
                    ))}
                    {template.checks.length > 3 && (
                      <li className="text-xs text-gray-600">+{template.checks.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* CTA */}
              <Link
                href={`${ROUTES.PLAYGROUND}?template=${template.id}`}
                className="btn-primary text-sm text-center w-full"
              >
                Use template
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* OSS callout */}
      <div className="max-w-2xl mx-auto mt-16 card gradient-border p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Build your own template</h2>
        <p className="text-gray-400 text-sm mb-4">
          Templates are defined as JSON and can be versioned alongside your code. Contribute to the OSS repo.
        </p>
        <a
          href="https://github.com/Hardonian/Reach"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}
