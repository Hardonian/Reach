export const metadata = {
  title: "Provider Routing — ReadyLayer Docs",
  description: "OpenRouter-style provider abstraction with fallback and cost/latency optimization.",
};

export default function ProvidersDocsPage() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1>Provider Routing</h1>
      <p>
        ReadyLayer uses an OpenRouter-style abstraction layer for model providers. Runs are
        automatically routed to the best provider based on your configuration.
      </p>

      <h2>Routing Strategies</h2>
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>default</code>
            </td>
            <td>Use the default provider and its primary model</td>
          </tr>
          <tr>
            <td>
              <code>cost-optimized</code>
            </td>
            <td>Route to the cheapest model across all providers</td>
          </tr>
          <tr>
            <td>
              <code>latency-optimized</code>
            </td>
            <td>Route to the fastest model across all providers</td>
          </tr>
        </tbody>
      </table>

      <h2>Fallback</h2>
      <p>
        Each provider can declare a fallback provider. If a request fails, the system automatically
        retries with the fallback.
      </p>

      <h2>Built-in Providers</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> — Claude Opus 4, Claude Sonnet 4, Claude Haiku 3.5 (default)
        </li>
        <li>
          <strong>OpenRouter</strong> — Multi-provider gateway with cost aggregation
        </li>
        <li>
          <strong>OpenAI</strong> — GPT-4o, GPT-4o Mini
        </li>
      </ul>

      <h2>API</h2>
      <pre>
        <code>{`GET /api/v1/providers   # List all providers and default`}</code>
      </pre>

      <h2>Configuration</h2>
      <p>
        Provider settings are available under Settings. Advanced controls (cost/latency weights,
        fallback chains) are hidden by default.
      </p>
    </div>
  );
}
