import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Support | ReadyLayer",
  description:
    "ReadyLayer out to our support and engineering teams for assistance.",
};

export default function ContactSupportPage() {
  return (
    <div className="section-container py-16">
      <div className="max-w-2xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            Contact <span className="text-gradient">Support</span>
          </h1>
          <p className="text-gray-400">
            Submit a support ticket and our engineering team will get back to
            you based on your service tier.
          </p>
        </header>

        <form className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-gray-300"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Alex Chen"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-gray-300"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="alex@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="tier" className="text-sm font-medium text-gray-300">
              Support Tier
            </label>
            <select
              id="tier"
              name="tier"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-colors appearance-none"
            >
              <option value="community">Community (Best Effort)</option>
              <option value="pro">Professional (24h Response)</option>
              <option value="enterprise">Enterprise (4h Response)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="subject"
              className="text-sm font-medium text-gray-300"
            >
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-colors"
              placeholder="e.g. Capability Violation in Runner"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="message"
              className="text-sm font-medium text-gray-300"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-colors resize-none"
              placeholder="Please provide as much detail as possible, including pack hashes or run IDs..."
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-4 font-bold text-lg"
          >
            Submit Support Request
          </button>
        </form>

        <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10 text-xs text-gray-500 flex items-start gap-4">
          <span className="text-xl">🛡️</span>
          <p>
            By submitting this form, you acknowledge that support requests are
            processed according to your organization&apos;s active SLA. Data
            submitted via this form is transient and protected under our
            production security policy.
          </p>
        </div>
      </div>
    </div>
  );
}
