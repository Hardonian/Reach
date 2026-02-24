import Link from 'next/link';

export default function WhitepaperPage() {
  return (
    <div className="section-container py-16">
      <h1 className="text-4xl font-bold mb-4">Technical whitepaper</h1>
      <p className="text-gray-300 mb-6">The whitepaper content is maintained in repository docs and explains determinism, evidence chain, and replay guarantees.</p>
      <ul className="list-disc ml-6 text-gray-300 space-y-2">
        <li><Link href="https://github.com/reach-sh/reach/tree/main/docs/whitepaper" className="text-accent hover:underline">Abstract</Link></li>
        <li><Link href="https://github.com/reach-sh/reach/tree/main/docs/whitepaper" className="text-accent hover:underline">Security whitepaper</Link></li>
      </ul>
    </div>
  );
}
