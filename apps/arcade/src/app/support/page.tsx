'use client';

import { FormEvent, useState } from 'react';

type Citation = { title: string; path: string; section: string };

export default function SupportPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Ask about policy denials, handshake errors, or replay mismatch.');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/support/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = (await res.json()) as { answer?: string; citations?: Citation[] };
    setAnswer(data.answer || 'No answer available.');
    setCitations(data.citations || []);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>Reach Support</h1>
      <form onSubmit={onSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why did delegation fail?"
          style={{ width: '100%', minHeight: 120, marginBottom: 12 }}
        />
        <button type="submit" disabled={busy}>{busy ? 'Thinking…' : 'Ask support bot'}</button>
      </form>
      <section aria-live="polite" style={{ marginTop: 16 }}>
        <p>{answer}</p>
        <ul>
          {citations.map((c) => (
            <li key={`${c.path}-${c.section}`}>{c.title} — {c.path}#{c.section}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
