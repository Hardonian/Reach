import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ReadyLayer",
  description: "Terms and conditions for using the ReadyLayer execution fabric.",
};

export default function TermsPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto prose prose-invert prose-accent">
        <h1>Terms of Service</h1>
        <p className="text-gray-400">Last updated: February 20, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the ReadyLayer Protocol, you agree to be bound by these Terms.
            ReadyLayer is a tool for developers to build deterministic agentic workloads.
          </p>
        </section>

        <section>
          <h2>2. Permitted Use</h2>
          <p>
            Users are responsible for the agents they build and the tool capabilities they grant.
            ReadyLayer provides the enforcement layer, but the logic and safety of individual packs
            reside with the creator.
          </p>
        </section>

        <section>
          <h2>3. Intellectual Property</h2>
          <p>
            The core ReadyLayer engine is licensed under Apache 2.0. Any proprietary execution packs
            uploaded to the Marketplace remain the property of the creator unless otherwise
            specified.
          </p>
        </section>

        <section>
          <h2>4. Limitation of Liability</h2>
          <p>
            ReadyLayer is provided "as is" without warranty of any kind. We are not liable for
            unpredictable agent behavior or tool side effects arising from misconfigured capability
            manifests.
          </p>
        </section>

        <section>
          <h2>5. Termination</h2>
          <p>
            We reserve the right to suspend accounts that violate security policies or intentionally
            attempt to bypass the deterministic engine boundaries.
          </p>
        </section>
      </div>
    </div>
  );
}
