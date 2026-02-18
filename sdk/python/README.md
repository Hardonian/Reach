# Reach Python SDK

Python SDK for Reach - deterministic execution fabric for AI systems.

## Installation

```bash
pip install reach-sdk
```

## Quick Start

```python
from reach_sdk import create_client

# Create client (connects to local server by default)
client = create_client()

# Check health
health = client.health()
print(f"Status: {health['status']}")

# Create a run
run = client.create_run(capabilities=["tool.read"])
print(f"Run ID: {run['id']}")

# Get run events
events = client.get_run_events(run['id'])
for event in events:
    print(f"Event: {event['type']}")

# Create a capsule
capsule = client.create_capsule(run['id'])
print(f"Capsule created: {capsule['capsulePath']}")
```

## Configuration

```python
from reach_sdk import ReachClient

# Connect to remote server
client = ReachClient(
    base_url="http://reach-server.example.com:8787",
    timeout=60.0
)
```

## Error Handling

```python
from reach_sdk import ReachClient
from reach_sdk.exceptions import ReachAPIError, ReachTimeoutError

client = ReachClient()

try:
    run = client.get_run("invalid-id")
except ReachAPIError as e:
    print(f"API Error: {e.code} - {e.message}")
    if e.remediation:
        print(f"Remediation: {e.remediation}")
except ReachTimeoutError:
    print("Request timed out")
```

## Streaming Events

```python
# Stream events in real-time
for event in client.stream_run_events(run['id']):
    print(f"Event: {event['type']} - {event['payload']}")
```

## License

Apache 2.0
