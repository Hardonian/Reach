"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { ROUTES } from "@/lib/routes";

type Mode = "magic_link" | "password";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_state_mismatch: "Sign-in was cancelled or expired. Please try again.",
  github_token_failed: "Could not connect to GitHub. Please try again.",
  github_no_email: "No public email on your GitHub account. Use magic link instead.",
  github_callback_error: "GitHub sign-in failed. Please try again.",
  magic_link_error: "Magic link expired or invalid. Request a new one.",
  magic_link_unverified: "Magic link verification is not available in this environment.",
  invalid_link: "Sign-in link was invalid. Please request a new one.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("magic_link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errorKey = searchParams?.get("error");
    if (errorKey && OAUTH_ERRORS[errorKey]) {
      setError(OAUTH_ERRORS[errorKey]);
    }
  }, [searchParams]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await track("signup_started", {
        method: "magic_link",
        source: "login_page",
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
      setInfo("Check your email for a sign-in link.");
      if (data.dev_link) {
        setInfo(`Dev mode link: ${data.dev_link}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.API.V1.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function githubSignIn() {
    track("signup_started", { method: "github_oauth", source: "login_page" });
    window.location.href = ROUTES.API.V1.AUTH.GITHUB;
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
            <span className="text-white font-bold text-lg">R</span>
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-white">Sign in to ReadyLayer</h1>
        <p className="text-gray-400 mt-1 text-sm">No password required · free forever</p>
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

        <button
          type="button"
          onClick={githubSignIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-border bg-surface hover:bg-white/5 transition-colors text-sm font-medium mb-4"
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

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-500">
            <span className="bg-surface px-2">or</span>
          </div>
        </div>

        <div className="flex gap-2 mb-4 p-1 rounded-lg bg-background border border-border">
          <button
            type="button"
            onClick={() => setMode("magic_link")}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              mode === "magic_link" ? "bg-accent/20 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            Magic link
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              mode === "password" ? "bg-accent/20 text-white" : "text-gray-500 hover:text-white"
            }`}
          >
            Password
          </button>
        </div>

        {mode === "magic_link" && (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending link…" : "Send magic link"}
            </button>
          </form>
        )}

        {mode === "password" && (
          <form onSubmit={handlePassword} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          No account?{" "}
          <Link href="/cloud/register" className="text-accent hover:underline">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function CloudLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
