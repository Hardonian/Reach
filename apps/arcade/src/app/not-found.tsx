import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="section-container py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
          <Link href="/docs" className="btn-secondary">
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
