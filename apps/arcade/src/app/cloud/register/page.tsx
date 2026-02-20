'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CloudRegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', displayName: '', tenantName: '', tenantSlug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-generate slug from tenant name
      if (key === 'tenantName') {
        next.tenantSlug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return; }
      router.push('/cloud');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-surface shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 mt-2">Start with Reach Cloud</p>
        </div>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'displayName', label: 'Display Name', type: 'text', placeholder: 'Jane Smith' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '8+ characters' },
            { key: 'tenantName', label: 'Organization Name', type: 'text', placeholder: 'Acme Corp' },
            { key: 'tenantSlug', label: 'Organization Slug', type: 'text', placeholder: 'acme-corp' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={type} value={form[key as keyof typeof form]}
                onChange={(e) => update(key, e.target.value)}
                required className="w-full px-3 py-2 bg-background border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder={placeholder}
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="w-full py-2 px-4 bg-accent text-black font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/cloud/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
