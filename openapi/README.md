# Reach OpenAPI Specification This directory contains the OpenAPI 3.1.0 specification for the Reach API.

## Files - `reach.openapi.yaml` - The main OpenAPI specification file

## Versioning The Reach API follows semantic versioning with the following policy:

- **apiVersion**: The API implementation version (e.g., "1.0.0")
- **specVersion**: The OpenAPI spec version this document represents
- Breaking changes result in a new API version path (e.g., `/v2/...`)
- Non-breaking additions are backward compatible within the same major version

## Endpoints Overview ### System
- `GET /health` - Health check
- `GET /version` - API version information

### Runs - `POST /runs` - Create a new run
- `GET /runs/{id}` - Get run details
- `GET /runs/{id}/events` - Get run events (supports SSE streaming)
- `POST /runs/{id}/replay` - Replay a run

### Capsules - `POST /capsules` - Create a capsule from a run
- `POST /capsules/verify` - Verify a capsule

### Federation - `GET /federation/status` - Get federation status

### Packs - `GET /packs` - List/search packs
- `POST /packs/install` - Install a pack
- `POST /packs/verify` - Verify a pack

## Error Codes The Reach API uses the following error codes:

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request body or parameters are invalid |
| `RUN_NOT_FOUND` | The specified run ID does not exist |
| `CAPSULE_NOT_FOUND` | The specified capsule was not found |
| `PACK_NOT_FOUND` | The specified pack was not found |
| `INTERNAL_ERROR` | An unexpected error occurred |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |

## Local Development By default, the Reach server runs on `http://127.0.0.1:8787` in local mode with no authentication required.
