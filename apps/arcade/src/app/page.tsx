import { HeroMedia } from "@/components/HeroMedia";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { CTA, HOW_IT_WORKS, CAPABILITIES, BEFORE_AFTER } from "@/lib/copy";
import { resolveVariant } from "@/lib/ab";
import { HomepageClient, HomepageExtraCapabilities } from "@/components/HomepageClient";

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const variant = resolveVariant(params);
  const primaryCaps = CAPABILITIES.filter((c) => c.primary);
  const extraCaps = CAPABILITIES.filter((c) => !c.primary);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Reach",
    url: "https://reach.dev",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Linux, macOS, Windows",
    description:
      "Natural-language governance control plane with deterministic CI gates, memory-backed policy generation, and replay-first explainability.",
    featureList: [
      "Natural language governance assistant",
      "Durable governance memory",
      "Deterministic NL-to-spec compiler",
      "Replay-first hash verification",
      "Model-agnostic CI gate integration",
    ],
    softwareHelp: "https://reach.dev/docs/governance",
  };

  const machineReadableSummary = {
    product: "Reach",
    positioning: [
      "natural-language-governance",
      "deterministic-ci-gate",
      "memory-aware-policy-engine",
      "model-agnostic",
      "replay-first",
      "anti-theatre",
    ],
    ossInstall:
      "curl -sSL https://github.com/reach/reach/releases/latest/download/install.sh | bash",
    oneCommandDemo: "npm run governance:demo",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/json"
        id="reach-machine-summary"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(machineReadableSummary) }}
      />
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center">
        <HeroMedia
          videoSrc="/hero/reach-hero.mp4"
          fallbackSrc="/hero/reach-hero-fallback.png"
          className="absolute inset-0"
        />

        <div className="section-container relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-gray-300">The Governance OS for Enterprise AI</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight">
              <span className="text-gradient">Enforce agent compliance.</span>
              <span> In your CI.</span>
            </h1>

            <p className="text-xl text-gray-400 mb-3 max-w-2xl">
              Use the open-source Reach CLI for deterministic local runs, and upgrade to the Reach
              Cloud for enterprise-grade governance, security, and scale.
            </p>

            <p className="text-base text-emerald-400 font-medium mb-8">
              Your first deterministic run is 30 seconds away. Zero setup required.
            </p>

            <div className="flex flex-wrap gap-4 mb-4">
              <Link href={ROUTES.PLAYGROUND} className="btn-primary text-lg">
                Run Live Demo
              </Link>
              <Link href={ROUTES.DOCS} className="btn-secondary text-lg">
                Install OSS CLI
              </Link>
              <Link
                href={ROUTES.CONTACT}
                className="text-gray-400 hover:text-white transition-colors text-base self-center"
              >
                Talk to Sales →
              </Link>
            </div>

            <p className="text-sm text-gray-500">{CTA.reassurance}</p>
          </div>
        </div>
      </section>

      {/* See it work — inline demo */}
      <section className="py-16 bg-surface/40 border-y border-border">
        <div className="section-container">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">See it work — right now</h2>
            <p className="text-gray-400">No account. No setup. Just click.</p>
          </div>
          <HomepageClient variant={variant} />
        </div>
      </section>

      <section className="py-16">
        <div className="section-container">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-background/50 p-6">
            <h2 className="text-2xl font-bold mb-3">OSS Install + One Command Demo</h2>
            <p className="text-gray-400 text-sm mb-4">
              Reach works in OSS mode by default. Start local, then promote to enforced CI gates.
            </p>
            <pre className="rounded-lg border border-border bg-surface p-4 text-xs overflow-x-auto">
              <code>{`curl -sSL https://github.com/reach/reach/releases/latest/download/install.sh | bash\nnpm run governance:demo`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-surface/30">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              From first run to shipping — in three steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="card gradient-border">
                <div className="text-3xl mb-4 text-accent">{item.icon}</div>
                <div className="text-xs font-mono text-accent mb-2">{item.step}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-24">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Reach Governs</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Every run covers the things that break in production.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-4">
            {primaryCaps.map((cap) => (
              <Link
                key={cap.title}
                href={cap.href}
                className="card group hover:border-accent/50 transition-all"
              >
                <h3 className="font-bold mb-2 group-hover:text-accent transition-colors">
                  {cap.title}
                </h3>
                <p className="text-gray-400 text-sm">{cap.description}</p>
                <div className="mt-4 flex items-center text-accent text-sm font-medium">
                  Learn more
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          <HomepageExtraCapabilities caps={extraCaps} />
        </div>
      </section>

      {/* Before vs After */}
      <section className="py-24 bg-surface/30">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Before vs After</h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border border-border">
              <div className="bg-red-950/30 border-b border-border px-6 py-3 text-sm font-semibold text-red-400">
                Before
              </div>
              <div className="bg-emerald-950/30 border-b border-border px-6 py-3 text-sm font-semibold text-emerald-400 border-l border-border">
                After
              </div>
              {BEFORE_AFTER.map((row, i) => (
                <>
                  <div
                    key={`b-${i}`}
                    className="px-6 py-4 text-sm text-gray-400 border-b border-border bg-red-950/10"
                  >
                    {row.before}
                  </div>
                  <div
                    key={`a-${i}`}
                    className="px-6 py-4 text-sm text-gray-200 border-b border-border border-l bg-emerald-950/10"
                  >
                    {"✓ "}
                    {row.after}
                  </div>
                </>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-accent/5 to-transparent" />
        <div className="section-container relative z-10">
          <div className="card max-w-3xl mx-auto text-center p-12 gradient-border">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start free. Ship with confidence.
            </h2>
            <p className="text-gray-400 mb-2 max-w-lg mx-auto">
              No credit card. No configuration. One click to your first check.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              OSS install path included · Model-agnostic · Replay-first
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href={ROUTES.PLAYGROUND} className="btn-primary">
                {CTA.primary}
              </Link>
              <Link href={ROUTES.REGISTER} className="btn-secondary">
                {CTA.secondary}
              </Link>
              <Link href={ROUTES.CONTACT} className="btn-secondary">
                {CTA.sales}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
