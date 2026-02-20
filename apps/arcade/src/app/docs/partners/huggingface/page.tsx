import Link from 'next/link';

export const metadata = { title: 'Hugging Face Integration — Reach Partners' };

export default function HuggingFacePartnerPage() {
  return (
    <div className="section-container py-20 max-w-4xl prose prose-invert">
      <div className="mb-8">
        <Link href="/docs" className="text-accent hover:underline text-sm">← Docs</Link>
      </div>
      <h1>Hugging Face Integration</h1>
      <p className="lead">
        Use any Hugging Face model as an agent backbone in Reach workflows via the HF Inference API or a self-hosted endpoint.
      </p>

      <h2>Value Proposition</h2>
      <ul>
        <li>Access 400,000+ models (LLaMA, Mistral, Falcon, Phi, Gemma, Qwen…)</li>
        <li>Serverless inference — no GPU provisioning required</li>
        <li>Bring your own endpoint for private models or Dedicated Inference Endpoints</li>
        <li>OpenAI-compatible Messages API supported for easy migration</li>
      </ul>

      <h2>Setup</h2>

      <h3>1. Get your HF API token</h3>
      <ol>
        <li>Go to <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener">huggingface.co/settings/tokens</a></li>
        <li>Create a token with <strong>Read</strong> scope (or Fine-grained if using private models)</li>
        <li>Copy the token</li>
      </ol>

      <h3>2. Configure environment variables</h3>
      <pre><code>{`# Required
HF_API_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional overrides
HF_BASE_URL=https://api-inference.huggingface.co
HF_TIMEOUT_MS=30000
HF_MAX_RETRIES=3

# For self-hosted / Dedicated Endpoints:
HF_BASE_URL=https://your-endpoint.endpoints.huggingface.cloud`}</code></pre>

      <h3>3. Use in a workflow</h3>
      <p>Add an <strong>Agent</strong> node in the Workflow Builder and set the model field:</p>
      <pre><code>{`// Agent node config
{
  "model": "meta-llama/Llama-3.1-70B-Instruct",
  "temperature": 0.7,
  "max_tokens": 2048
}`}</code></pre>

      <p>Or call directly from a custom pack:</p>
      <pre><code>{`import { getHFProvider } from '@reach/sdk/providers/hf';

const hf = getHFProvider();

// Chat completion (OpenAI-compatible)
const result = await hf.chat({
  model: 'mistralai/Mistral-7B-Instruct-v0.3',
  messages: [
    { role: 'user', content: 'Summarize this document: ...' }
  ],
  max_tokens: 512,
});

// Embeddings
const embeddings = await hf.embed(
  'sentence-transformers/all-MiniLM-L6-v2',
  ['Hello world', 'Reach is awesome']
);`}</code></pre>

      <h2>Cost Notes</h2>
      <ul>
        <li><strong>Serverless (free tier):</strong> Rate-limited, good for development and low-traffic workloads</li>
        <li><strong>Pro API ($9/mo):</strong> Higher rate limits, priority routing</li>
        <li><strong>Dedicated Endpoints:</strong> Fixed cost per hour, best for production — from ~$0.06/hr per GPU</li>
        <li><strong>Self-hosted:</strong> Free if you have your own infrastructure; set <code>HF_BASE_URL</code> to your server</li>
      </ul>

      <h2>Supported Features</h2>
      <table>
        <thead><tr><th>Feature</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Text generation</td><td>✅ Supported</td></tr>
          <tr><td>Chat completion (Messages API)</td><td>✅ Supported</td></tr>
          <tr><td>Embeddings / feature extraction</td><td>✅ Supported</td></tr>
          <tr><td>Image classification</td><td>🔜 Planned</td></tr>
          <tr><td>Streaming responses</td><td>🔜 Planned</td></tr>
          <tr><td>Fine-tuned private models</td><td>✅ Via Dedicated Endpoints</td></tr>
        </tbody>
      </table>

      <h2>Troubleshooting</h2>
      <ul>
        <li><strong>503 "Model is loading":</strong> The adapter auto-retries with the recommended <code>retry-after</code> delay. Serverless models cold-start on first request.</li>
        <li><strong>429 Rate limited:</strong> The adapter retries with exponential backoff. Consider upgrading to HF Pro.</li>
        <li><strong>Timeout:</strong> Increase <code>HF_TIMEOUT_MS</code> for large models. Default is 30s.</li>
        <li><strong>401 Unauthorized:</strong> Check that <code>HF_API_TOKEN</code> is set and the model requires no special access.</li>
      </ul>

      <h2>Security Notes</h2>
      <ul>
        <li>Never log or expose <code>HF_API_TOKEN</code> — Reach sanitizes logs by default</li>
        <li>Use least-privilege token scope (Read only unless model upload is needed)</li>
        <li>For production, prefer Dedicated Endpoints over serverless for consistent latency</li>
        <li>Validate model outputs before passing to downstream tools (use a Validation node)</li>
      </ul>
    </div>
  );
}
