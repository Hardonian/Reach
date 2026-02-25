export default function AbsoluteStatePrdLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-40 rounded bg-slate-200/80 dark:bg-slate-700/60" />
      <div className="h-10 w-72 rounded bg-slate-200/80 dark:bg-slate-700/60" />
      <div className="h-4 w-full max-w-3xl rounded bg-slate-200/80 dark:bg-slate-700/60" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60" />
        <div className="h-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60" />
      </div>
    </div>
  );
}
