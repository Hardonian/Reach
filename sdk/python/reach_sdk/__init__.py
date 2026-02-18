"""
Reach SDK - Python client for deterministic execution fabric
"""

from reach_sdk.client import ReachClient, create_client
from reach_sdk.exceptions import ReachError, ReachAPIError, ReachTimeoutError
from reach_sdk.types import (
    Run,
    Event,
    Capsule,
    CapsuleManifest,
    Pack,
    FederationNode,
    VerificationResult,
    ReachClientConfig,
)

__version__ = "1.0.0"
__all__ = [
    "ReachClient",
    "create_client",
    "ReachError",
    "ReachAPIError",
    "ReachTimeoutError",
    "Run",
    "Event",
    "Capsule",
    "CapsuleManifest",
    "Pack",
    "FederationNode",
    "VerificationResult",
    "ReachClientConfig",
]
