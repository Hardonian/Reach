"""
Exception classes for the Reach SDK
"""

from typing import Any, Dict, Optional


class ReachError(Exception):
    """Base exception for Reach SDK errors"""

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        details: Optional[Dict[str, Any]] = None,
        remediation: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}
        self.remediation = remediation

    def __str__(self) -> str:
        parts = [f"[{self.code}] {self.message}"]
        if self.remediation:
            parts.append(f"Remediation: {self.remediation}")
        return " | ".join(parts)


class ReachAPIError(ReachError):
    """Error returned from the Reach API"""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int,
        details: Optional[Dict[str, Any]] = None,
        remediation: Optional[str] = None,
    ):
        super().__init__(message, code, details, remediation)
        self.status_code = status_code


class ReachTimeoutError(ReachError):
    """Request timeout error"""

    def __init__(self, message: str = "Request timed out"):
        super().__init__(
            message,
            code="TIMEOUT",
            remediation="Increase timeout or check server availability",
        )


class ReachNetworkError(ReachError):
    """Network connectivity error"""

    def __init__(self, message: str = "Network error"):
        super().__init__(
            message,
            code="NETWORK_ERROR",
            remediation="Check network connectivity and server status",
        )
