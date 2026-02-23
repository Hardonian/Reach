export default function Authentication() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a
            href="/docs"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Authentication</h1>
        <p className="text-gray-400 mb-8">
          Secure your API requests with API keys, tokens, and OAuth2.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">API Keys</h2>
            <p className="text-gray-400 mb-4">
              API keys are the simplest way to authenticate with ReadyLayer.
              Include your key in the Authorization header:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>Authorization: Bearer YOUR_API_KEY</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Generating API Keys</h2>
            <p className="text-gray-400 mb-4">
              Create API keys from the Dashboard or via CLI:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300 mb-4">
              <p>{`# Create a new API key`}</p>
              <p>reach auth create-key --name "Production Key"</p>
              <p>{``}</p>
              <p>{`# List existing keys`}</p>
              <p>reach auth list-keys</p>
              <p>{``}</p>
              <p>{`# Revoke a key`}</p>
              <p>reach auth revoke-key KEY_ID</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">OAuth2</h2>
            <p className="text-gray-400 mb-4">
              For third-party applications, use OAuth2 to obtain access tokens
              on behalf of users:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# Authorization URL`}</p>
              <p>https://api.reach.dev/oauth/authorize</p>
              <p>{`  ?client_id=YOUR_CLIENT_ID`}</p>
              <p>{`  &response_type=code`}</p>
              <p>{`  &redirect_uri=YOUR_REDIRECT_URI`}</p>
              <p>{`  &scope=agents:read agents:write`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Token Exchange</h2>
            <p className="text-gray-400 mb-4">
              Exchange authorization code for access token:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>POST /oauth/token</p>
              <p>Content-Type: application/json</p>
              <p>{``}</p>
              <p>{`{`}</p>
              <p>{`  "grant_type": "authorization_code",`}</p>
              <p>{`  "client_id": "YOUR_CLIENT_ID",`}</p>
              <p>{`  "client_secret": "YOUR_CLIENT_SECRET",`}</p>
              <p>{`  "code": "AUTH_CODE",`}</p>
              <p>{`  "redirect_uri": "YOUR_REDIRECT_URI"`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Scopes</h2>
            <p className="text-gray-400 mb-4">Available OAuth scopes:</p>
            <div className="grid md:grid-cols-2 gap-4 text-gray-400">
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">agents:read</code>
                <p className="text-sm mt-1">Read agent data</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">agents:write</code>
                <p className="text-sm mt-1">Create and modify agents</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">pipelines:read</code>
                <p className="text-sm mt-1">Read pipeline data</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">pipelines:write</code>
                <p className="text-sm mt-1">Create and modify pipelines</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">executions:read</code>
                <p className="text-sm mt-1">View execution logs</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent">admin</code>
                <p className="text-sm mt-1">Full administrative access</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Security Best Practices</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Store API keys securely (use environment variables)</li>
              <li>• Rotate keys regularly</li>
              <li>• Use separate keys for different environments</li>
              <li>• Never commit keys to version control</li>
              <li>• Use the minimum required scopes for your use case</li>
              <li>• Implement key revocation procedures</li>
            </ul>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Rate Limits</h2>
            <p className="text-gray-400 mb-4">
              Authentication endpoints have specific rate limits:
            </p>
            <div className="bg-black/50 p-4 rounded-lg text-gray-400">
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Token requests</span>
                <span>100/minute</span>
              </div>
              <div className="flex justify-between py-2">
                <span>API key creation</span>
                <span>10/minute</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
