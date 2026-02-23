"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";
import { CTA } from "@/lib/copy";

export default function CloudRegisterPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function githubSignUp() {
    track("signup_started", {
      method: "github_oauth",
      source: "register_page",
    });
    window.location.href = `${ROUTES.API.V1.AUTH.GITHUB}?next=/dashboard`;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await track("signup_started", {
        method: "magic_link",
        source: "register_page",
      });
      const res = await fetch(ROUTES.API.V1.AUTH.MAGIC_LINK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        dev_link?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send link");
        return;
      }
      setInfo("Check your email — we sent you a sign-in link.");
      if (data.dev_link) setInfo(`Dev mode link: ${data.dev_link}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
              <span className="text-white font-bold text-lg">R</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your free account</h1>
          <p className="text-gray-400 mt-1 text-sm">{CTA.reassurance}</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm break-all">
              {info}
            </div>
          )}

          {/* GitHub — primary fastest path */}
          <button
            type="button"
            onClick={githubSignUp}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-border bg-surface hover:bg-white/5 transition-colors text-sm font-medium mb-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Continue with GitHub
          </button>
          <p className="text-xs text-gray-600 text-center mb-4">
            Fastest — imports your identity automatically
          </p>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="bg-surface px-2">or use your email</span>
            </div>
          </div>

          {/* Magic link form */}
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="you@yourcompany.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending link…" : "Continue with email"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/cloud/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-xs text-center text-gray-600">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="hover:text-gray-400">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="hover:text-gray-400">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
