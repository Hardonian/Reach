export default function ArchitectureLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
          Loading Architecture
        </p>
      </div>
    </div>
  );
}
