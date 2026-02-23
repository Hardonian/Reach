/**
 * ReadyLayer Alert Service
 *
 * Evaluates monitor run values against signal thresholds.
 * Dispatches email (via HTTP relay) or webhook notifications when thresholds are crossed.
 *
 * Email dispatch requires READYLAYER_ALERT_EMAIL_ENDPOINT (HTTP relay) or
 * SMTP_HOST/SMTP_USER/SMTP_PASS for direct SMTP.
 */

import { env } from "./env";
import { logger } from "./logger";
import { listAlertRules, type Signal, type MonitorRun } from "./cloud-db";

// ── Threshold evaluation ──────────────────────────────────────────────────

export function shouldAlert(signal: Signal, value: number): boolean {
  const t = signal.threshold as Record<string, unknown>;
  if (typeof t.min === "number" && value < t.min) return true;
  if (typeof t.max === "number" && value > t.max) return true;
  if (typeof t.equals === "number" && value === t.equals) return true;
  // Sensible defaults when no explicit threshold configured
  if (Object.keys(t).length === 0) {
    if (signal.type === "latency") return value > 5000;
    if (signal.type === "drift") return value > 0.5;
    if (signal.type === "regression_rate") return value > 0.1;
    return value > 0;
  }
  return false;
}

// ── Email dispatch via HTTP relay (avoids SMTP dep) ───────────────────────

async function sendEmailViaRelay(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  // Supports any transactional email relay with a simple POST API (Resend, Postmark, custom).
  // Set READYLAYER_ALERT_EMAIL_ENDPOINT to your HTTP relay URL.
  const endpoint = process.env.READYLAYER_ALERT_EMAIL_ENDPOINT;
  if (!endpoint) {
    logger.warn(
      "READYLAYER_ALERT_EMAIL_ENDPOINT not set — email alert skipped",
      { to },
    );
    return;
  }
  try {
    const apiKey = process.env.READYLAYER_ALERT_EMAIL_API_KEY ?? "";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        from: env.READYLAYER_ALERT_EMAIL_FROM ?? "noreply@readylayer.com",
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      logger.warn("Email relay returned non-200", { status: res.status, to });
    } else {
      logger.info("Alert email sent", { to });
    }
  } catch (err) {
    logger.warn("Failed to send alert email", { err: String(err), to });
  }
}

// ── Webhook dispatch ──────────────────────────────────────────────────────

async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn("Webhook alert returned non-200", {
        status: res.status,
        url,
      });
    } else {
      logger.info("Webhook alert sent", { url });
    }
  } catch (err) {
    logger.warn("Failed to send webhook alert", { err: String(err), url });
  }
}

// ── Public dispatcher ─────────────────────────────────────────────────────

export async function dispatchAlerts(
  tenantId: string,
  signal: Signal,
  monitorRun: MonitorRun,
): Promise<void> {
  const rules = listAlertRules(tenantId).filter(
    (r) =>
      r.status === "enabled" &&
      (r.signal_id === null || r.signal_id === signal.id),
  );

  const baseUrl = env.READYLAYER_BASE_URL ?? "https://app.readylayer.com";
  const subject = `[ReadyLayer Alert] ${signal.name} — ${signal.type} threshold crossed`;
  const body = [
    `Signal: ${signal.name} (${signal.type})`,
    `Value: ${monitorRun.value}`,
    `Recorded at: ${monitorRun.created_at}`,
    ``,
    `View monitoring: ${baseUrl}/monitoring`,
  ].join("\n");

  const promises = rules.map(async (rule) => {
    if (rule.channel === "email") {
      await sendEmailViaRelay(rule.destination, subject, body);
    } else {
      await sendWebhook(rule.destination, {
        alert: subject,
        signal: { id: signal.id, name: signal.name, type: signal.type },
        monitor_run: {
          id: monitorRun.id,
          value: monitorRun.value,
          created_at: monitorRun.created_at,
        },
        details_url: `${baseUrl}/monitoring`,
      });
    }
  });

  await Promise.allSettled(promises);
}
