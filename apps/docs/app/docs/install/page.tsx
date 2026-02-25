import { DocLayout } from "@/components/doc-layout";
import { CodeBlock } from "@/components/code-block";

export default function InstallPage() {
  return (
    <DocLayout currentPath="/docs/install" title="Installation">
      <p className="text-lg text-slate-600 mb-8">
        Install Reach on your local machine to start building deterministic decision workflows.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">One-Line Install (Recommended)</h2>
        <p className="mb-4">
          The fastest way to install Reach is using our installation script. This will download the
          latest binary for your architecture and add it to your path.
        </p>
        <CodeBlock
          code={`curl -fsSL https://github.com/reach/reach/releases/latest/download/install.sh | bash`}
          language="bash"
        />
        <p className="mt-4 text-sm text-slate-500">
          Note: This requires <code>curl</code> and <code>bash</code>. For Windows users, we
          recommend using WSL2.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Manual Binary Download</h2>
        <p className="mb-4">
          You can download the pre-compiled binaries directly from our GitHub Releases page.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <a
              href="https://github.com/reach/reach/releases"
              className="text-blue-600 hover:underline"
            >
              GitHub Releases
            </a>
          </li>
        </ul>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="font-medium mb-2">Verify Checksums</p>
          <p className="text-sm text-slate-600">
            Always verify the authenticity of the downloaded binary using the provided SHA256
            checksums:
          </p>
          <CodeBlock code={`sha256sum -c reach_checksums.txt`} language="bash" />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Build From Source</h2>
        <p className="mb-4">
          For developers wanting to contribute or use the latest edge features:
        </p>
        <CodeBlock
          code={`git clone https://github.com/reach/reach.git
cd reach
npm install
make build`}
          language="bash"
        />
        <p className="mt-4 text-sm text-slate-500">
          Requires Node.js 20+, Rust (latest stable), and Go 1.22+.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Post-Install Verification</h2>
        <p className="mb-4">After installation, verify that Reach is correctly configured:</p>
        <CodeBlock
          code={`reach version
reach doctor`}
          language="bash"
        />
        <p className="mt-4">
          The <code>doctor</code> command is your first line of defense. It ensures your environment
          is capable of deterministic execution.
        </p>
      </section>

      <footer className="mt-12 pt-8 border-t border-slate-200">
        <p className="text-slate-500">
          Need help? Check our{" "}
          <a href="/docs/troubleshooting" className="text-blue-600 hover:underline">
            Troubleshooting
          </a>{" "}
          guide or{" "}
          <a href="/support" className="text-blue-600 hover:underline">
            Support
          </a>{" "}
          page.
        </p>
      </footer>
    </DocLayout>
  );
}
