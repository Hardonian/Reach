# ReadyLayer Skill Library Manifests

This document serves as the canonical source of truth for the 20 core skills supported by the Agent Reliability Suite.

---

## 1. web_search

- **Description:** Searches the public web via indexed search engines.
- **Inputs Schema:** `{ query: string, count: number, offset: number }`
- **Tool Requirements:** Bing/Google/Serper API key.
- **Model Hints:** Use for factual grounding, recent events, and brand research.
- **Eval Hooks:** `source_count > 0`, `relevance_score > 0.8`.
- **Failure Patterns:** Rate limiting (429), Empty results (404), Hallucinated URLs.
- **Version:** 1.2.0

## 2. browse_url

- **Description:** Fetches and extracts content from a specific URL.
- **Inputs Schema:** `{ url: string, mode: 'text' | 'markdown' | 'screenshot' }`
- **Tool Requirements:** Headless browser (Puppeteer/Playwright).
- **Model Hints:** Use for deep dives into documentation, news articles, or competitor sites.
- **Eval Hooks:** `content_length > 500`, `no_403_errors`.
- **Failure Patterns:** CAPTCHA blocking, Anti-bot detection, JS-heavy rendering failures.
- **Version:** 2.1.0

## 3. write_file

- **Description:** Writes text content to a path within a guarded directory.
- **Inputs Schema:** `{ path: string, content: string, overwrite: boolean }`
- **Tool Requirements:** Local filesystem access with restricted base path.
- **Model Hints:** Use for saving reports, code generation, or persistent configuration.
- **Eval Hooks:** `file_exists(path)`, `checksum_match`.
- **Failure Patterns:** Path traversal attempts (blocked), Disk full (ENOSPC), Permission denied.
- **Version:** 1.0.1

## 4. read_file

- **Description:** Reads and returns the content of a file.
- **Inputs Schema:** `{ path: string, encoding: 'utf8' | 'base64' }`
- **Tool Requirements:** Local filesystem access.
- **Model Hints:** Use for analyzing logs, reading config, or content ingestion.
- **Eval Hooks:** `file_size < limit_mb`, `encoding_valid`.
- **Failure Patterns:** File not found, Binary file read attempt, Symlink loops.
- **Version:** 1.0.1

## 5. list_directory

- **Description:** Lists contents of a directory.
- **Inputs Schema:** `{ path: string, depth: number }`
- **Tool Requirements:** Local filesystem access.
- **Model Hints:** Use for exploring project structures or verifying batch operations.
- **Eval Hooks:** `child_count > 0`, `directory_exists`.
- **Failure Patterns:** Access denied, Unmounted drive.
- **Version:** 1.0.0

## 6. execute_command

- **Description:** Runs a shell command in a restricted environment.
- **Inputs Schema:** `{ command: string, args: string[], timeout_ms: number }`
- **Tool Requirements:** Sandboxed shell execution.
- **Model Hints:** Use for running tests, build scripts, or system utilities.
- **Eval Hooks:** `exit_code == 0`, `stderr_empty`.
- **Failure Patterns:** Command not found, Timeout exceeded, Banned command execution.
- **Version:** 1.1.0

## 7. query_database

- **Description:** Executes a SQL/NoSQL query.
- **Inputs Schema:** `{ query: string, params: object, type: 'sql' | 'mongodb' }`
- **Tool Requirements:** DB connection strings (read-only recommended).
- **Model Hints:** Use for retrieval from business-critical data stores.
- **Eval Hooks:** `row_count < 1000`, `query_time < 5s`.
- **Failure Patterns:** SQL injection attempt (blocked), Database down, Query syntax error.
- **Version:** 1.0.0

## 8. send_email

- **Description:** Sends an email notification.
- **Inputs Schema:** `{ to: string, subject: string, body: string, attachments: string[] }`
- **Tool Requirements:** SMTP server or SendGrid/Postmark API.
- **Model Hints:** Use for alerts, reports, or customer outreach.
- **Eval Hooks:** `smtp_response_250`, `attachment_size_valid`.
- **Failure Patterns:** Spam filter rejection, Invalid email format, Attachment too large.
- **Version:** 1.0.0

## 9. slack_notify

- **Description:** Posts a message to a Slack channel.
- **Inputs Schema:** `{ channel: string, message: string, blocks: object[] }`
- **Tool Requirements:** Slack Webhook or Bot Token.
- **Model Hints:** Use for real-time team status updates and alerts.
- **Eval Hooks:** `ok: true`, `message_ts_returned`.
- **Failure Patterns:** Invalid channel, Bot not in channel, Rate limited.
- **Version:** 1.0.2

## 10. github_pr_review

- **Description:** Comments on and reviews a GitHub Pull Request.
- **Inputs Schema:** `{ owner: string, repo: string, pr_number: number, comment: string, event: 'APPROVE' | 'REQUEST_CHANGES' }`
- **Tool Requirements:** GitHub App or PAT with repo scope.
- **Model Hints:** Use for automated code review and CI gating logic.
- **Eval Hooks:** `event_submitted`, `comment_visible`.
- **Failure Patterns:** PR closed, Insufficient permissions, GHP token expired.
- **Version:** 1.1.0

## 11. stripe_refund

- **Description:** Processes a refund for a Stripe transaction.
- **Inputs Schema:** `{ charge_id: string, amount: number, reason: string }`
- **Tool Requirements:** Stripe Restricted API Key.
- **Model Hints:** Use for support agents handling billing disputes.
- **Eval Hooks:** `refund_status == 'succeeded'`, `approval_id_present`.
- **Failure Patterns:** Insufficient funds, Charge already refunded, Invalid charge ID.
- **Version:** 1.0.0

## 12. calendly_list_events

- **Description:** Lists upcoming events from Calendly.
- **Inputs Schema:** `{ user_uri: string, min_start_time: string }`
- **Tool Requirements:** Calendly OAuth2 token.
- **Model Hints:** Use for scheduling assistants and availability checks.
- **Eval Hooks:** `event_count >= 0`, `api_v2_response`.
- **Failure Patterns:** Expired OAuth token, URI mismatch.
- **Version:** 1.0.0

## 13. weather_lookup

- **Description:** Gets current weather information for a location.
- **Inputs Schema:** `{ location: string, units: 'metric' | 'imperial' }`
- **Tool Requirements:** OpenWeatherMap/WeatherStack API.
- **Model Hints:** Use for travel planning or logistics agents.
- **Eval Hooks:** `temp_present`, `location_match`.
- **Failure Patterns:** Unknown city, API down.
- **Version:** 1.0.0

## 14. crypto_price_feed

- **Description:** Fetches real-time price for a crypto asset.
- **Inputs Schema:** `{ symbol: string, currency: string }`
- **Tool Requirements:** CoinGecko/CoinMarketCap API.
- **Model Hints:** Use for trading agents and portfolio trackers.
- **Eval Hooks:** `price > 0`, `timestamp_current`.
- **Failure Patterns:** Invalid symbol, Stale price data (drift).
- **Version:** 1.0.3

## 15. translate_text

- **Description:** Translates text between languages.
- **Inputs Schema:** `{ text: string, target_lang: string, source_lang?: string }`
- **Tool Requirements:** DeepL/Google Translate API.
- **Model Hints:** Use for cross-border support and localization.
- **Eval Hooks:** `translation_length_ratio > 0.5`, `confidence > 0.9`.
- **Failure Patterns:** Language not supported, Input too long.
- **Version:** 1.0.0

## 16. summarize_document

- **Description:** Distills long content into an executive summary.
- **Inputs Schema:** `{ content: string, format: 'bullets' | 'paragraph', maxLength: number }`
- **Tool Requirements:** LLM context window > 32k.
- **Model Hints:** Use for news aggregators and legal review summaries.
- **Eval Hooks:** `summary_length < input_length`, `key_points_extracted > 3`.
- **Failure Patterns:** Information loss (drift), Context window overflow.
- **Version:** 1.5.0

## 17. extract_pii

- **Description:** Identifies and classifies PII in a block of text.
- **Inputs Schema:** `{ text: string, scrub: boolean }`
- **Tool Requirements:** NLP-based PII detector.
- **Model Hints:** Use for compliance checks and privacy gates.
- **Eval Hooks:** `pii_entities_found >= 0`, `scrubbed_text_valid`.
- **Failure Patterns:** False negatives (high risk), False positives (high noise).
- **Version:** 2.0.0

## 18. generate_image

- **Description:** Generates an image from a description.
- **Inputs Schema:** `{ prompt: string, size: '1024x1024' | '512x512' }`
- **Tool Requirements:** DALL-E 3 / Midjourney API.
- **Model Hints:** Use for UI assets, marketing, and creative agents.
- **Eval Hooks:** `image_url_returned`, `content_safety_pass`.
- **Failure Patterns:** Safety filter triggered, Prompt too vague.
- **Version:** 1.0.0

## 19. audio_to_text

- **Description:** Transcribes audio files to text.
- **Inputs Schema:** `{ audio_url: string, format: string, language?: string }`
- **Tool Requirements:** Whisper v3 / AssemblyAI.
- **Model Hints:** Use for meeting summarizers and voice assistants.
- **Eval Hooks:** `wer (word error rate) < 0.2`, `timestamps_present`.
- **Failure Patterns:** Low audio quality, Multiple speakers overlap (diarization fail).
- **Version:** 1.2.0

## 20. ocr_extract

- **Description:** Extracts text and tables from images/PDFs.
- **Inputs Schema:** `{ file_url: string, mode: 'fast' | 'high_accuracy' }`
- **Tool Requirements:** Tesseract / AWS Textract / Google Vision.
- **Model Hints:** Use for digitizing receipts, forms, and contracts.
- **Eval Hooks:** `text_extracted`, `table_structure_preserved`.
- **Failure Patterns:** Handwriting recognition failure, Rotated images, Low DPI.
- **Version:** 2.1.0
