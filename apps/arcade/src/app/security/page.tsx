import Link from 'next/link';

export default function SecurityPage() {
  return (
    <div className="section-container py-16 space-y-8">
      <h1 className="text-4xl font-bold">Security</h1>
      <div className="card p-8">
        <h2 className="text-2xl font-semibold mb-2">Threat model</h2>
        <p className="text-gray-400">Focus areas: tampering with event logs, non-deterministic execution drift, and policy bypass at tool boundaries.</p>
      </div>
      <div className="card p-8">
        <h2 className="text-2xl font-semibold mb-2">Attack surface summary</h2>
        <p className="text-gray-400">Runner and API integrations are the primary boundaries. Signed packs and replay verification are used to constrain and inspect execution.</p>
      </div>
      <div className="card p-8">
        <h2 className="text-2xl font-semibold mb-2">SBOM and dependency notes</h2>
        <p className="text-gray-400">Dependencies are tracked in repository manifests; operators should generate SBOMs during release and review transitive dependency updates.</p>
      </div>
      <div className="card p-8">
        <h2 className="text-2xl font-semibold mb-2">Versioning policy</h2>
        <p className="text-gray-400">Versioning follows repository releases. Security fixes are documented in changelog entries and coordinated disclosure process.</p>
        <div className="mt-4 flex gap-4">
          <Link href="/responsible-disclosure" className="btn-secondary">Disclosure policy</Link>
          <Link href="/changelog" className="btn-secondary">Changelog</Link>
        </div>
      </div>
    </div>
  );
}
