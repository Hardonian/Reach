export default function RoadmapPage() {
  return (
    <div className="section-container py-16 space-y-6">
      <h1 className="text-4xl font-bold">Roadmap</h1>
      <div className="card p-6"><h2 className="font-semibold mb-2">Near term</h2><p className="text-gray-400">Determinism verification ergonomics, docs hardening, and pack gallery quality.</p></div>
      <div className="card p-6"><h2 className="font-semibold mb-2">Mid term</h2><p className="text-gray-400">Improved replay diagnostics and reproducibility reporting.</p></div>
      <div className="card p-6"><h2 className="font-semibold mb-2">Non-goals</h2><p className="text-gray-400">No unverifiable "black box" autonomy claims and no proprietary lock-in in OSS core paths.</p></div>
    </div>
  );
}
