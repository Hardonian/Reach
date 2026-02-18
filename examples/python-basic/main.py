"""
Reach Python SDK Basic Example

This example demonstrates basic usage of the Reach Python SDK.

Prerequisites:
    1. Reach server running on http://127.0.0.1:8787
       Start with: reach serve
    2. Dependencies installed
       Run: pip install -r requirements.txt

Usage:
    python main.py
"""

from reach_sdk import create_client
from reach_sdk.exceptions import ReachError


def main():
    print("=== Reach Python SDK Example ===\n")

    # Create client
    client = create_client(base_url="http://127.0.0.1:8787")

    try:
        # 1. Check server health
        print("1. Checking server health...")
        health = client.health()
        print(f"   Status: {health['status']}")
        print(f"   Version: {health['version']}\n")

        # 2. Get API version info
        print("2. Getting API version...")
        version = client.version()
        print(f"   API Version: {version['apiVersion']}")
        print(f"   Spec Version: {version['specVersion']}\n")

        # 3. Create a new run
        print("3. Creating a new run...")
        run = client.create_run(
            capabilities=["tool.read", "tool.write"],
            plan_tier="free",
        )
        print(f"   Run ID: {run['id']}")
        print(f"   Status: {run['status']}\n")

        # 4. Get run details
        print("4. Getting run details...")
        run_details = client.get_run(run["id"])
        print(f"   Run ID: {run_details['id']}")
        print(f"   Created: {run_details['created_at']}\n")

        # 5. Get run events
        print("5. Getting run events...")
        events = client.get_run_events(run["id"])
        print(f"   Events count: {len(events)}\n")

        # 6. Search packs
        print("6. Searching packs...")
        packs = client.search_packs(query="demo")
        print(f"   Found {len(packs)} pack(s):")
        for pack in packs:
            print(f"   - {pack['name']} (verified: {pack['verified']})")
        print()

        # 7. Get federation status
        print("7. Getting federation status...")
        federation = client.get_federation_status()
        print(f"   Nodes: {len(federation)}\n")

        print("=== Example completed successfully ===")

    except ReachError as e:
        print(f"Error: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    main()
