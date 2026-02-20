import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | Reach',
  description: 'Information about how Reach uses cookies and browser storage.',
};

export default function CookiesPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto prose prose-invert prose-accent">
        <h1>Cookie Policy</h1>
        <p className="text-gray-400">Last updated: February 20, 2026</p>

        <section>
          <h2>1. Minimalist Approach</h2>
          <p>
            Reach uses a strictly minimalist approach to browser storage. We do not use advertising
            trackers or third-party marketing cookies.
          </p>
        </section>

        <section>
          <h2>2. Essential Cookies</h2>
          <p>
            We only use cookies that are technically necessary for the operation of the Reach Arcade:
          </p>
          <ul>
            <li><strong>__session:</strong> Encrypted session token for authentication.</li>
            <li><strong>__tenant_id:</strong> Used to maintain context between dashboard views.</li>
            <li><strong>reach_theme:</strong> Stores your preference for Dark or Light mode.</li>
          </ul>
        </section>

        <section>
          <h2>3. Managing Cookies</h2>
          <p>
            You can disable cookies in your browser settings, but please note that the Reach Arcade
            dashboard will not function without the essential session cookies.
          </p>
        </section>

        <section>
          <h2>4. Local Storage</h2>
          <p>
            We may use the <code>localStorage</code> API to cache non-sensitive configuration data
            locally for performance optimization.
          </p>
        </section>
      </div>
    </div>
  );
}
