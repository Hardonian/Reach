export default function Installation() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Installation</h1>
        <p className="text-gray-400 mb-8">
          Install ReadyLayer on your local machine or deploy to your infrastructure.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">System Requirements</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Node.js 18.0 or higher</li>
              <li>• npm 9.0 or higher (or yarn/pnpm)</li>
              <li>• Git 2.30 or higher</li>
              <li>• 4GB RAM minimum (8GB recommended)</li>
            </ul>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Install via npm</h2>
            <p className="text-gray-400 mb-4">
              The recommended way to install ReadyLayer is through npm:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>npm install -g @reach/cli</p>
            </div>
            <p className="text-gray-400">Verify the installation:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>reach --version</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Install via Docker</h2>
            <p className="text-gray-400 mb-4">
              For containerized environments, use our official Docker image:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>docker pull reach/cli:latest</p>
            </div>
            <p className="text-gray-400">Run ReadyLayer commands through Docker:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>docker run -it -v $(pwd):/workspace reach/cli reach create my-agent</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Install from Source</h2>
            <p className="text-gray-400 mb-4">For development or to build from source:</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>git clone https://github.com/XHARDONIANXSLASHXReadyLayer.git</p>
              <p>XCDXReadyLayer</p>
              <p>npm install</p>
              <p>npm run build</p>
              <p>npm link</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Troubleshooting</h2>
            <div className="space-y-4 text-gray-400">
              <div>
                <h3 className="font-semibold text-white">Permission Errors (Linux/Mac)</h3>
                <p>
                  If you encounter permission errors, you may need to use sudo or fix npm
                  permissions:
                </p>
                <div className="bg-black/50 p-3 rounded-lg font-mono text-sm mt-2">
                  <p>sudo npm install -g @reach/cli</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Windows Installation</h3>
                <p>
                  On Windows, use PowerShell or Command Prompt as Administrator, or use WSL2 for the
                  best experience.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
