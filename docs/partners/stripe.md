# Stripe Integration

## Overview
Reach uses Stripe for metering usage and billing Enterprise customers.

## Metered Events
- `execution_seconds`: Time spent running.
- `storage_gb_hours`: Artifact storage duration.
- `token_usage`: Pass-through LLM costs.

## Webhooks
The Reach Integration Hub listens for `invoice.payment_succeeded` to unlock tier limits.
