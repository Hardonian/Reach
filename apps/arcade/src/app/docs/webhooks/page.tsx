export default function Webhooks() {
  return (
    <div className="section-container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a href="/docs" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Documentation
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Webhooks</h1>
        <p className="text-gray-400 mb-8">
          Receive real-time notifications when events occur in your ReadyLayer environment.
        </p>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-xl font-bold mb-4">What are Webhooks?</h2>
            <p className="text-gray-400">
              Webhooks allow you to receive HTTP callbacks when specific events happen in ReadyLayer. Instead of polling for changes, webhooks push event data to your endpoint in real-time.
            </p>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Creating a Webhook</h2>
            <p className="text-gray-400 mb-4">
              Register a webhook endpoint using the API:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>POST /v1/webhooks</p>
              <p>Content-Type: application/json</p>
              <p>Authorization: Bearer YOUR_API_KEY</p>
              <p>{``}</p>
              <p>{`{`}</p>
              <p>{`  "url": "https://your-app.com/webhooks/reach",`}</p>
              <p>{`  "events": ["agent.executed", "pipeline.completed"],`}</p>
              <p>{`  "secret": "your_webhook_secret"`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Available Events</h2>
            <div className="grid md:grid-cols-2 gap-4 text-gray-400">
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">agent.created</code>
                <p className="text-sm mt-1">New agent created</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">agent.updated</code>
                <p className="text-sm mt-1">Agent configuration changed</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">agent.executed</code>
                <p className="text-sm mt-1">Agent was invoked</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">agent.deployed</code>
                <p className="text-sm mt-1">Agent deployed to production</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">pipeline.started</code>
                <p className="text-sm mt-1">Pipeline execution began</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">pipeline.completed</code>
                <p className="text-sm mt-1">Pipeline finished execution</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">pipeline.failed</code>
                <p className="text-sm mt-1">Pipeline execution failed</p>
              </div>
              <div className="bg-black/30 p-3 rounded">
                <code className="text-accent text-sm">execution.logged</code>
                <p className="text-sm mt-1">New execution log entry</p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Webhook Payload</h2>
            <p className="text-gray-400 mb-4">
              Event payloads include event type, timestamp, and data:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`{`}</p>
              <p>{`  "event": "agent.executed",`}</p>
              <p>{`  "timestamp": "2024-01-15T10:30:00Z",`}</p>
              <p>{`  "webhook_id": "wh_123",`}</p>
              <p>{`  "data": {`}</p>
              <p>{`    "agent_id": "agent_abc",`}</p>
              <p>{`    "execution_id": "exec_xyz",`}</p>
              <p>{`    "status": "success",`}</p>
              <p>{`    "duration_ms": 1500`}</p>
              <p>{`  }`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Verifying Signatures</h2>
            <p className="text-gray-400 mb-4">
              Verify webhook authenticity using the signature header:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`// Node.js example`}</p>
              <p>{`const crypto = require('crypto');`}</p>
              <p>{``}</p>
              <p>{`function verifyWebhook(payload, signature, secret) {`}</p>
              <p>{`  const expected = crypto`}</p>
              <p>{`    .createHmac('sha256', secret)`}</p>
              <p>{`    .update(payload)`}</p>
              <p>{`    .digest('hex');`}</p>
              <p>{`  return crypto.timingSafeEqual(`}</p>
              <p>{`    Buffer.from(signature),`}</p>
              <p>{`    Buffer.from(expected)`}</p>
              <p>{`  );`}</p>
              <p>{`}`}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Retry Policy</h2>
            <p className="text-gray-400 mb-4">
              If your endpoint returns a non-2xx status code, ReadyLayer will retry with exponential backoff:
            </p>
            <div className="bg-black/50 p-4 rounded-lg text-gray-400">
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Attempt 1</span>
                <span>Immediate</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Attempt 2</span>
                <span>After 1 second</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-700">
                <span>Attempt 3</span>
                <span>After 2 seconds</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Max Attempts</span>
                <span>5</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Best Practices</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Respond quickly (within 5 seconds) to avoid timeouts</li>
              <li>• Process webhooks asynchronously for long-running tasks</li>
              <li>• Store webhook events before processing to prevent data loss</li>
              <li>• Implement idempotency to handle duplicate deliveries</li>
              <li>• Use HTTPS endpoints only</li>
              <li>• Verify signatures to ensure authenticity</li>
              <li>• Return 2xx status codes for successful receipt</li>
            </ul>
          </section>

          <section className="card">
            <h2 className="text-xl font-bold mb-4">Testing Webhooks</h2>
            <p className="text-gray-400 mb-4">
              Use the CLI to test webhook delivery:
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-sm text-gray-300">
              <p>{`# Send a test event`}</p>
              <p>reach webhooks test WEBHOOK_ID --event agent.executed</p>
              <p>{``}</p>
              <p>{`# View recent deliveries`}</p>
              <p>reach webhooks deliveries WEBHOOK_ID</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
