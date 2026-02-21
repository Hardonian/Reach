export default function ConsoleLoading() {
  return (
    <div className="min-h-screen bg-[#101622] flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#135bec] border-t-transparent animate-spin" />
        <p className="text-[#9da6b9] text-xs font-black uppercase tracking-widest">Loading Console</p>
      </div>
    </div>
  );
}
