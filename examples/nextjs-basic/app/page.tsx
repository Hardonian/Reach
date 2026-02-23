/**
 * Next.js Page Component for Reach Demo
 */

import { createReachClient } from "@reach/sdk";

const client = createReachClient({
  baseUrl: process.env.REACH_BASE_URL || "http://127.0.0.1:8787",
});

export default async function HomePage() {
  let health;
  let version;
  let packs;

  try {
    health = await client.health();
    version = await client.version();
    packs = await client.searchPacks();
  } catch (error) {
    console.error("Failed to fetch Reach data:", error);
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Reach Next.js Integration</h1>

      {health ? (
        <>
          <section style={{ marginBottom: "2rem" }}>
            <h2>Server Health</h2>
            <p>Status: {health.status}</p>
            <p>Version: {health.version}</p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>API Version</h2>
            <p>API Version: {version?.apiVersion}</p>
            <p>Spec Version: {version?.specVersion}</p>
            <p>Compatibility: {version?.compatibilityPolicy}</p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Available Packs</h2>
            <ul>
              {packs?.results.map((pack) => (
                <li key={pack.name}>
                  {pack.name} - {pack.verified ? "✓ Verified" : "Not verified"}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p style={{ color: "red" }}>
          Failed to connect to Reach server. Make sure it&apos;s running on
          http://127.0.0.1:8787
        </p>
      )}

      <section>
        <h2>API Routes</h2>
        <ul>
          <li>
            <code>GET /api/reach?action=health</code>
          </li>
          <li>
            <code>GET /api/reach?action=federation</code>
          </li>
          <li>
            <code>POST /api/reach?action=create-run</code>
          </li>
          <li>
            <code>POST /api/reach?action=create-capsule</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
