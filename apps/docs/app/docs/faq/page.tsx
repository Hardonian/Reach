import { DocLayout } from "@/components/doc-layout";

export default function FAQPage() {
  const faqs = [
    {
      q: "Why does determinism matter for AI?",
      a: "Determinism allows you to replay any AI decision with exactly the same inputs and logic. This is critical for debugging, auditing, and meeting compliance requirements in production systems where 'black box' behavior is unacceptable.",
    },
    {
      q: "Does Reach replace my existing LLM framework?",
      a: "No. Reach acts as a governance and decision layer *above* your existing logic. Use it to wrap high-stakes decisions, enforce policy gates, and maintain an auditable ledger of execution.",
    },
    {
      q: "What's the difference between Reach and ReadyLayer?",
      a: "Reach is the open-source CLI and engine. ReadyLayer is the managed enterprise platform that provides centralized governance, team collaboration, and hosted runner orchestration.",
    },
    {
      q: "How do I fix 'non-determinism detected' errors?",
      a: "This usually happens when your logic depends on unseeded randomness, current system time, or environment-dependent floating point behavior. Use Reach shims for Date.now() and Math.random() to ensure consistency.",
    },
  ];

  return (
    <DocLayout currentPath="/docs/faq" title="FAQ">
      <p className="text-lg text-slate-600 mb-8">
        Common questions about Reach installation, usage, and the philosophy of deterministic execution.
      </p>

      <div className="space-y-8">
        {faqs.map((faq, i) => (
          <div key={i} className="border-b border-slate-200 pb-6">
            <h3 className="text-xl font-bold text-slate-900 mb-3">{faq.q}</h3>
            <p className="text-slate-600 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-xl border border-blue-100">
        <h3 className="text-lg font-bold text-blue-900 mb-2">Still have questions?</h3>
        <p className="text-blue-800 mb-4">
          Our community and maintainers are here to help.
        </p>
        <a href="/support" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
          Get Support
        </a>
      </div>
    </DocLayout>
  );
}
