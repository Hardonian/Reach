import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white py-12 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Support</h1>
            <p className="text-slate-400">
              Resources for troubleshooting and getting help with Reach
            </p>
          </div>
          <Link
            href="/"
            className="text-slate-400 hover:text-white border border-slate-700 px-4 py-2 rounded-lg transition"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-16 px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* GitHub Issues */}
          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <h2 className="text-2xl font-bold mb-4">GitHub Issues</h2>
            <p className="text-slate-600 mb-6">
              Found a bug or have a feature request? GitHub is the authoritative place for technical
              issues.
            </p>
            <div className="space-y-4">
              <a
                href="https://github.com/reach/reach/issues"
                className="block text-blue-600 hover:underline font-medium"
              >
                Report a Bug →
              </a>
              <a
                href="https://github.com/reach/reach/issues"
                className="block text-blue-600 hover:underline font-medium"
              >
                Request a Feature →
              </a>
            </div>
          </section>

          {/* Documentation */}
          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <h2 className="text-2xl font-bold mb-4">Documentation</h2>
            <p className="text-slate-600 mb-6">
              Our documentation covers installation, configuration, and deep dives into the Reach
              architecture.
            </p>
            <div className="space-y-4">
              <Link
                href="/docs/quickstart"
                className="block text-blue-600 hover:underline font-medium"
              >
                Quickstart Guide →
              </Link>
              <Link
                href="/docs/troubleshooting"
                className="block text-blue-600 hover:underline font-medium"
              >
                Troubleshooting Docs →
              </Link>
              <Link href="/docs/faq" className="block text-blue-600 hover:underline font-medium">
                Read the FAQ →
              </Link>
            </div>
          </section>

          {/* Community */}
          <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <h2 className="text-2xl font-bold mb-4">Community</h2>
            <p className="text-slate-600 mb-6">Connect with other Reach users and maintainers.</p>
            <div className="space-y-4">
              <a
                href="https://discord.gg/reach"
                className="block text-blue-600 hover:underline font-medium"
              >
                Join our Discord (placeholder) →
              </a>
              <a
                href="https://x.com/reach_cli"
                className="block text-blue-600 hover:underline font-medium"
              >
                Follow on X →
              </a>
            </div>
          </section>

          {/* Enterprise Support */}
          <section className="bg-slate-900 p-8 rounded-2xl text-white shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">Enterprise Support</h2>
            <p className="text-slate-400 mb-6">
              ReadyLayer customers get access to logic-guaranteed support SLAs and 24/7 incident
              response.
            </p>
            <a
              href="https://ready-layer.com/contact"
              className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 transition w-full text-center"
            >
              Contact ReadyLayer
            </a>
          </section>
        </div>

        <section className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Security Vulnerabilities</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Please do not report security vulnerabilities via public GitHub issues. Follow our
            <a
              href="https://github.com/reach/reach/blob/main/SECURITY.md"
              className="text-blue-600 hover:underline ml-1"
            >
              Security Policy
            </a>{" "}
            to report them responsibly.
          </p>
        </section>
      </main>

      <footer className="py-12 px-4 border-t border-slate-200 text-center text-slate-500 text-sm">
        <p>© 2026 Reach. Multi-domain OSS/Enterprise support.</p>
      </footer>
    </div>
  );
}
