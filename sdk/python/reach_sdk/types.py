"""
Type definitions for the Reach SDK
"""

from typing import Any, Dict, List, Literal, Optional, TypedDict


class ReachClientConfig(TypedDict, total=False):
    """Configuration for the Reach client"""

    base_url: str
    timeout: float


class Run(TypedDict):
    """A Reach execution run"""

    id: str
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    tier: Optional[str]
    capabilities: Optional[List[str]]
    created_at: str
    completed_at: Optional[str]


class Event(TypedDict):
    """An event in a run's event log"""

    id: int
    type: str
    payload: Dict[str, Any]
    created_at: str


class CapsuleManifest(TypedDict, total=False):
    """Manifest for a time capsule"""

    spec_version: str
    run_id: str
    run_fingerprint: str
    registry_snapshot_hash: str
    pack: Dict[str, Any]
    policy: Dict[str, Any]
    federation_path: List[str]
    trust_scores: Dict[str, float]
    audit_root: str
    environment: Dict[str, str]
    created_at: str


class Capsule(TypedDict):
    """A time capsule containing run data"""

    manifest: CapsuleManifest
    event_log: List[Dict[str, Any]]


class Pack(TypedDict):
    """An execution pack from the registry"""

    name: str
    repo: str
    spec_version: str
    signature: Optional[str]
    reproducibility: Optional[Literal["A", "B", "C", "D", "F"]]
    verified: bool


class FederationNode(TypedDict, total=False):
    """A node in the federation"""

    node_id: str
    status: Literal["active", "inactive", "quarantined"]
    capabilities: List[str]
    latency_ms: int
    load_score: int
    trust_score: float
    quarantined: bool


class VerificationResult(TypedDict, total=False):
    """Result of a verification operation"""

    verified: bool
    name: str
    signature_valid: bool
    spec_compatible: bool
    run_id: str
    run_fingerprint: str
    recomputed_fingerprint: str
    audit_root: str
