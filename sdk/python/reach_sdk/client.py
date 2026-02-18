"""
Reach API client implementation
"""

from typing import Any, Dict, Iterator, List, Optional

import httpx

from reach_sdk.exceptions import ReachAPIError, ReachError, ReachNetworkError, ReachTimeoutError
from reach_sdk.types import (
    Capsule,
    Event,
    FederationNode,
    Pack,
    Run,
    VerificationResult,
)


class ReachClient:
    """
    Client for interacting with the Reach API.

    Args:
        base_url: The base URL for the Reach API. Defaults to http://127.0.0.1:8787
        timeout: Request timeout in seconds. Defaults to 30
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8787",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout),
            headers={"Accept": "application/json"},
        )

    def _request(
        self,
        method: str,
        path: str,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Make an HTTP request to the API"""
        try:
            response = self._client.request(
                method=method,
                url=path,
                json=json_data,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException as e:
            raise ReachTimeoutError(str(e)) from e
        except httpx.NetworkError as e:
            raise ReachNetworkError(str(e)) from e
        except httpx.HTTPStatusError as e:
            try:
                error_data = e.response.json()
                raise ReachAPIError(
                    message=error_data.get("error", f"HTTP {e.response.status_code}"),
                    code=error_data.get("code", "UNKNOWN_ERROR"),
                    status_code=e.response.status_code,
                    details=error_data.get("details"),
                    remediation=error_data.get("remediation"),
                ) from e
            except (ValueError, AttributeError):
                raise ReachAPIError(
                    message=f"HTTP {e.response.status_code}",
                    code="HTTP_ERROR",
                    status_code=e.response.status_code,
                ) from e
        except Exception as e:
            raise ReachError(str(e)) from e

    def close(self) -> None:
        """Close the HTTP client"""
        self._client.close()

    def __enter__(self) -> "ReachClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    # System endpoints
    def health(self) -> Dict[str, str]:
        """Check the health of the Reach server"""
        return self._request("GET", "/health")

    def version(self) -> Dict[str, Any]:
        """Get API version information"""
        return self._request("GET", "/version")

    # Run endpoints
    def create_run(
        self,
        capabilities: Optional[List[str]] = None,
        plan_tier: Optional[str] = None,
    ) -> Run:
        """
        Create a new run

        Args:
            capabilities: List of capabilities required for the run
            plan_tier: Plan tier (free, pro, enterprise)

        Returns:
            The created run
        """
        body: Dict[str, Any] = {}
        if capabilities is not None:
            body["capabilities"] = capabilities
        if plan_tier is not None:
            body["plan_tier"] = plan_tier

        return self._request("POST", "/runs", body)

    def get_run(self, run_id: str) -> Run:
        """
        Get a run by ID

        Args:
            run_id: The run ID

        Returns:
            The run
        """
        return self._request("GET", f"/runs/{run_id}")

    def get_run_events(self, run_id: str, after: Optional[int] = None) -> List[Event]:
        """
        Get events for a run

        Args:
            run_id: The run ID
            after: Event ID to start from

        Returns:
            List of events
        """
        params = f"?after={after}" if after is not None else ""
        result = self._request("GET", f"/runs/{run_id}/events{params}")
        return result.get("events", [])

    def stream_run_events(self, run_id: str) -> Iterator[Event]:
        """
        Stream events for a run using Server-Sent Events

        Args:
            run_id: The run ID

        Yields:
            Events as they arrive
        """
        import json

        with httpx.stream(
            "GET",
            f"{self.base_url}/runs/{run_id}/events",
            headers={"Accept": "text/event-stream"},
            timeout=self.timeout,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        yield event
                    except json.JSONDecodeError:
                        continue

    def replay_run(self, run_id: str) -> Dict[str, Any]:
        """
        Replay a run

        Args:
            run_id: The run ID to replay

        Returns:
            Replay result with verification status
        """
        return self._request("POST", f"/runs/{run_id}/replay")

    # Capsule endpoints
    def create_capsule(self, run_id: str) -> Dict[str, Any]:
        """
        Create a capsule from a run

        Args:
            run_id: The run ID to create a capsule from

        Returns:
            The created capsule
        """
        return self._request("POST", "/capsules", {"run_id": run_id})

    def verify_capsule(self, path: str) -> VerificationResult:
        """
        Verify a capsule

        Args:
            path: Path to the capsule file

        Returns:
            Verification result
        """
        return self._request("POST", "/capsules/verify", {"path": path})

    # Federation endpoints
    def get_federation_status(self) -> List[FederationNode]:
        """
        Get federation status

        Returns:
            List of federation nodes
        """
        result = self._request("GET", "/federation/status")
        return result.get("nodes", [])

    # Pack endpoints
    def search_packs(self, query: Optional[str] = None) -> List[Pack]:
        """
        Search for packs in the registry

        Args:
            query: Search query string

        Returns:
            List of matching packs
        """
        params = f"?q={query}" if query else ""
        result = self._request("GET", f"/packs{params}")
        return result.get("results", [])

    def install_pack(self, name: str) -> Dict[str, Any]:
        """
        Install a pack from the registry

        Args:
            name: Name of the pack to install

        Returns:
            Installation result
        """
        return self._request("POST", "/packs/install", {"name": name})

    def verify_pack(self, name: str) -> VerificationResult:
        """
        Verify a pack

        Args:
            name: Name of the pack to verify

        Returns:
            Verification result
        """
        return self._request("POST", "/packs/verify", {"name": name})


def create_client(
    base_url: str = "http://127.0.0.1:8787",
    timeout: float = 30.0,
) -> ReachClient:
    """
    Create a new Reach client

    Args:
        base_url: The base URL for the Reach API
        timeout: Request timeout in seconds

    Returns:
        A new ReachClient instance
    """
    return ReachClient(base_url=base_url, timeout=timeout)
