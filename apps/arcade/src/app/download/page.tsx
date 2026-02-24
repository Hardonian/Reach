export default function DownloadPage() {
  return (
    <div className="section-container py-16 space-y-8">
      <h1 className="text-4xl font-bold">Download Reach CLI</h1>
      <div className="card p-8">
        <p className="mb-3">Install script:</p>
        <pre className="bg-black/40 rounded p-4 text-sm overflow-x-auto">curl -fsSL https://reach-cli.com/install.sh | sh</pre>
      </div>
      <div className="card p-8">
        <p className="mb-2">If binaries are not published for your platform, build from source:</p>
        <pre className="bg-black/40 rounded p-4 text-sm overflow-x-auto">git clone https://github.com/reach-sh/reach && cd reach && cargo build --release</pre>
      </div>
    </div>
  );
}
