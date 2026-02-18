import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

interface KBEntry {
  id: string;
  title: string;
  keywords: string[];
  path: string;
  section: string;
  answer: string;
}

const unsafePatterns = ['bypass policy', 'disable signing', 'ignore replay', 'skip audit', 'unsafe tool'];

function redactSecrets(input: string): string {
  return input.replace(/(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
}

function isUnsafe(question: string): boolean {
  const q = question.toLowerCase();
  return unsafePatterns.some((p) => q.includes(p));
}

function score(entry: KBEntry, q: string): number {
  let s = 0;
  const title = entry.title.toLowerCase();
  if (q.includes(title) || title.includes(q)) s += 6;
  for (const k of entry.keywords) {
    if (q.includes(k.toLowerCase())) s += 3;
  }
  return s;
}

async function loadKB(): Promise<KBEntry[]> {
  const kbPath = path.join(process.cwd(), '..', '..', 'support', 'kb_index.json');
  const raw = await fs.readFile(kbPath, 'utf8');
  return JSON.parse(raw) as KBEntry[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = redactSecrets((body.question || '').trim());
  if (!question) {
    return NextResponse.json({ error: 'question required' }, { status: 400 });
  }
  if (isUnsafe(question)) {
    return NextResponse.json({
      answer:
        'I can’t help with bypassing policy, signing, audit, or replay checks. I can help with the safe troubleshooting path.',
      citations: [],
    });
  }
  const kb = await loadKB();
  const ranked = kb
    .map((entry) => ({ entry, score: score(entry, question.toLowerCase()) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => (b.score === a.score ? a.entry.id.localeCompare(b.entry.id) : b.score - a.score));
  if (ranked.length === 0) {
    return NextResponse.json({
      answer:
        'No exact match found. Try `reach federation status` and review docs/FEDERATION_COORDINATION.md and docs/SUPPORT_BOT.md.',
      citations: [],
    });
  }
  return NextResponse.json({
    answer: ranked[0].entry.answer,
    citations: ranked.slice(0, 3).map((r) => ({ title: r.entry.title, path: r.entry.path, section: r.entry.section })),
  });
}
