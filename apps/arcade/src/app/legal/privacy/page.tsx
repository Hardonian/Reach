import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Reach',
  description: 'Learn how Reach handles your data with transparency and security.',
};

export default function PrivacyPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto prose prose-invert prose-accent">
        <h1>Privacy Policy</h1>
        <p className="text-gray-400">Last updated: February 20, 2026</p>

        <section>
          <h2>1. Data Sovereignty</h2>
          <p>
            Reach is designed with "Data Sovereignty First" principles. By default, Reach operates 
            in your infrastructure. We only collect the minimal metadata required to orchestrate 
            determinstic execution packs across your distributed nodes.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <ul>
            <li><strong>Authentication Data:</strong> User IDs and tenant associations via your chosen identity provider.</li>
            <li><strong>Orchestration Metadata:</strong> Run IDs, status transitions, and tool capability references.</li>
            <li><strong>Telemetry:</strong> Anonymous performance metrics for engine optimization (opt-out available).</li>
          </ul>
        </section>

        <section>
          <h2>3. Data Retention</h2>
          <p>
            Audit logs and execution capsules are retained for 30 days by default in the managed service. 
            Self-hosted instances allow for indefinite retention policies managed by the operator.
          </p>
        </section>

        <section>
          <h2>4. Your Rights</h2>
          <p>
            You have the right to access, export, or delete your tenant data at any time via the 
            Reach Dashboard or the <code>reach account purge</code> CLI command.
          </p>
        </section>

        <section>
          <h2>5. Contact</h2>
          <p>
            For privacy-related inquiries, contact <a href="mailto:security@reach.dev">security@reach.dev</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
