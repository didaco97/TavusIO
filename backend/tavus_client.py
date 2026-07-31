"""
Tavus client utilities for SkillMeter's AI interview flow.

This client intentionally uses Tavus as the only live interview provider:
- Tavus persona creation in full-pipeline mode
- Tavus conversation creation / ending
- Verbose conversation fetch for transcript and perception data
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class TavusAPIError(RuntimeError):
    """Raised when Tavus returns an API or transport error."""

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


@dataclass
class TavusConfig:
    """Runtime configuration for the Tavus API client."""

    api_key: str
    base_url: str = "https://tavusapi.com/v2"
    replica_id: str = ""
    persona_id: str = ""
    callback_url: str = ""
    callback_secret: str = ""
    require_auth: bool = False
    test_mode: bool = False
    timeout_seconds: int = 30
    max_participants: int = 2

    @classmethod
    def from_env(cls) -> "TavusConfig":
        return cls(
            api_key=os.getenv("TAVUS_API_KEY", "").strip(),
            base_url=os.getenv("TAVUS_BASE_URL", "https://tavusapi.com/v2").rstrip("/"),
            replica_id=os.getenv("TAVUS_REPLICA_ID", "").strip(),
            persona_id=os.getenv("TAVUS_PERSONA_ID", "").strip(),
            callback_url=os.getenv("TAVUS_CALLBACK_URL", "").strip(),
            callback_secret=os.getenv("TAVUS_CALLBACK_SECRET", "").strip(),
            require_auth=_env_flag("TAVUS_REQUIRE_AUTH", default=False),
            test_mode=_env_flag("TAVUS_TEST_MODE", default=False),
            timeout_seconds=int(os.getenv("TAVUS_TIMEOUT_SECONDS", "30")),
            max_participants=max(2, int(os.getenv("TAVUS_MAX_PARTICIPANTS", "2"))),
        )

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.api_key:
            errors.append("TAVUS_API_KEY is not set")
        if not self.replica_id and not self.persona_id:
            errors.append("Set TAVUS_REPLICA_ID or TAVUS_PERSONA_ID")
        return errors


class TavusClient:
    """Small synchronous Tavus API wrapper used by interview routes."""

    def __init__(self, config: Optional[TavusConfig] = None) -> None:
        self.config = config or TavusConfig.from_env()

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.config.api_key,
            "Content-Type": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        errors = self.config.validate()
        if errors:
            raise TavusAPIError("; ".join(errors))

        url = f"{self.config.base_url}/{path.lstrip('/')}"
        if query:
            clean_query = {
                key: value
                for key, value in query.items()
                if value is not None and value != ""
            }
            if clean_query:
                url = f"{url}?{urllib.parse.urlencode(clean_query)}"

        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url=url,
            data=body,
            headers=self.headers,
            method=method.upper(),
        )

        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read().decode("utf-8").strip()
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8").strip()
            parsed: Dict[str, Any]
            if raw:
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = {"raw": raw}
            else:
                parsed = {}

            message = (
                parsed.get("error")
                or parsed.get("message")
                or f"Tavus returned HTTP {exc.code}"
            )
            logger.error("Tavus API error on %s %s: %s", method, url, message)
            raise TavusAPIError(message, status_code=exc.code, payload=parsed) from exc
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            logger.error("Unable to reach Tavus on %s %s: %s", method, url, reason)
            raise TavusAPIError(f"Unable to reach Tavus: {reason}") from exc

    def create_persona(
        self,
        *,
        name: str,
        system_prompt: str,
        document_ids: Optional[list[str]] = None,
        objectives_id: Optional[str] = None,
        guardrails_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "persona_name": name,
            "system_prompt": system_prompt,
            "pipeline_mode": "full",
        }
        if self.config.replica_id:
            payload["default_replica_id"] = self.config.replica_id
        if document_ids:
            payload["document_ids"] = document_ids
        if objectives_id:
            payload["objectives_id"] = objectives_id
        if guardrails_id:
            payload["guardrails_id"] = guardrails_id

        return self._request("POST", "/personas", payload=payload)

    def create_conversation(
        self,
        *,
        persona_id: str,
        conversation_name: str,
        conversational_context: str = "",
        custom_greeting: str = "",
        callback_url: str = "",
        audio_only: bool = False,
        document_ids: Optional[list[str]] = None,
        test_mode: Optional[bool] = None,
        require_auth: Optional[bool] = None,
        max_participants: Optional[int] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "persona_id": persona_id,
            "conversation_name": conversation_name,
            "audio_only": audio_only,
            "test_mode": self.config.test_mode if test_mode is None else test_mode,
            "require_auth": self.config.require_auth if require_auth is None else require_auth,
            "max_participants": max_participants or self.config.max_participants,
        }

        if self.config.replica_id:
            payload["replica_id"] = self.config.replica_id
        if callback_url:
            payload["callback_url"] = callback_url
        elif self.config.callback_url:
            payload["callback_url"] = self.config.callback_url
        if conversational_context:
            payload["conversational_context"] = conversational_context
        if custom_greeting:
            payload["custom_greeting"] = custom_greeting
        if document_ids:
            payload["document_ids"] = document_ids

        return self._request("POST", "/conversations", payload=payload)

    def get_conversation(self, conversation_id: str, *, verbose: bool = False) -> Dict[str, Any]:
        return self._request(
            "GET",
            f"/conversations/{conversation_id}",
            query={"verbose": "true" if verbose else None},
        )

    def end_conversation(self, conversation_id: str) -> Dict[str, Any]:
        return self._request("POST", f"/conversations/{conversation_id}/end")

    def list_replicas(self) -> Dict[str, Any]:
        return self._request("GET", "/replicas")


_client: Optional[TavusClient] = None


def get_tavus_client() -> TavusClient:
    """Return the shared Tavus client instance for the app process."""
    global _client
    if _client is None:
        _client = TavusClient()
    return _client
