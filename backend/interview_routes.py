"""
Tavus-native interview API routes.

The interview lifecycle is intentionally persisted in Django so the rest of
SkillMeter can treat interviews as first-class product data:
start -> Tavus conversation -> end -> transcript sync -> report generation.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Iterable, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .interview_services import (
    TavusAPIError,
    build_conversational_context,
    build_interview_prompt,
    generate_interview_report,
    get_tavus_client,
    normalize_transcript_messages,
    parse_cv,
)
from .models import AIInterviewSession, AIPerformanceReport, InterviewTranscriptEntry

import logging

logger = logging.getLogger(__name__)


VALID_LEVELS = {choice[0] for choice in AIInterviewSession.LEVEL_CHOICES}


def _parse_bool(value: Any, *, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _append_query_param(url: str, key: str, value: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query[key] = value
    return urlunparse(parsed._replace(query=urlencode(query)))


def _build_callback_url() -> str:
    client = get_tavus_client()
    callback_url = client.config.callback_url
    callback_secret = client.config.callback_secret

    if not callback_url:
        return ""
    if callback_secret:
        return _append_query_param(callback_url, "token", callback_secret)
    return callback_url


def _build_embed_url(conversation_url: Optional[str], meeting_token: str = "") -> Optional[str]:
    if not conversation_url:
        return None
    if meeting_token:
        return _append_query_param(conversation_url, "t", meeting_token)
    return conversation_url


def _extract_transcript(payload: Dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(payload.get("transcript"), list):
        return payload["transcript"]

    properties = payload.get("properties")
    if isinstance(properties, dict) and isinstance(properties.get("transcript"), list):
        return properties["transcript"]

    transcription_ready = payload.get("application.transcription_ready")
    if isinstance(transcription_ready, dict) and isinstance(transcription_ready.get("transcript"), list):
        return transcription_ready["transcript"]

    return []


def _extract_perception_analysis(payload: Dict[str, Any]) -> Any:
    if isinstance(payload.get("application.perception_analysis"), dict):
        return payload["application.perception_analysis"]

    properties = payload.get("properties")
    event_type = str(payload.get("event_type", "")).strip().lower()
    if event_type == "application.perception_analysis" and isinstance(properties, dict):
        return properties

    if isinstance(payload.get("perception_analysis"), dict):
        return payload["perception_analysis"]

    return None


def _extract_shutdown_reason(payload: Dict[str, Any]) -> Optional[str]:
    if payload.get("shutdown_reason"):
        return str(payload["shutdown_reason"])

    system_shutdown = payload.get("system.shutdown")
    if isinstance(system_shutdown, dict):
        reason = system_shutdown.get("shutdown_reason") or system_shutdown.get("reason")
        if reason:
            return str(reason)

    properties = payload.get("properties")
    if isinstance(properties, dict):
        reason = properties.get("shutdown_reason") or properties.get("reason")
        if reason:
            return str(reason)

    return None


def _get_owned_session(session_id: str, user) -> Optional[AIInterviewSession]:
    return AIInterviewSession.objects.filter(session_id=session_id, user=user).first()


def _replace_transcript_entries(
    session: AIInterviewSession,
    transcript_messages: Iterable[Dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized_entries = normalize_transcript_messages(transcript_messages)

    InterviewTranscriptEntry.objects.filter(session=session).delete()
    if normalized_entries:
        InterviewTranscriptEntry.objects.bulk_create(
            [
                InterviewTranscriptEntry(
                    session=session,
                    speaker=entry["speaker"],
                    text=entry["text"],
                    sequence_number=entry["sequence_number"],
                )
                for entry in normalized_entries
            ]
        )

    return normalized_entries


def _update_duration(session: AIInterviewSession) -> None:
    if session.started_at and session.ended_at:
        session.duration_seconds = max(
            0,
            int((session.ended_at - session.started_at).total_seconds()),
        )


def _upsert_report(
    session: AIInterviewSession,
    transcript_entries: Iterable[Dict[str, Any]],
    perception_analysis: Any = None,
) -> AIPerformanceReport:
    report_data = generate_interview_report(
        skill_topic=session.skill_topic,
        level=session.level,
        transcript_entries=transcript_entries,
        perception_analysis=perception_analysis,
    )

    report, _ = AIPerformanceReport.objects.update_or_create(
        session=session,
        defaults=report_data,
    )
    return report


def _serialize_report(report: Optional[AIPerformanceReport]) -> Optional[Dict[str, Any]]:
    if not report:
        return None

    return {
        "performance_summary": report.performance_summary,
        "strengths": report.strengths,
        "improvements": report.improvements,
        "topic_knowledge_score": report.topic_knowledge_score,
        "communication_score": report.communication_score,
        "problem_solving_score": report.problem_solving_score,
        "overall_score": report.overall_score,
        "recommendation": report.recommendation,
        "generated_at": report.generated_at.isoformat(),
    }


@transaction.atomic
def _apply_tavus_payload(
    session: AIInterviewSession,
    payload: Dict[str, Any],
    *,
    source: str,
) -> bool:
    provider_metadata = dict(session.provider_metadata or {})

    conversation_status = payload.get("status")
    if conversation_status:
        provider_metadata["conversation_status"] = conversation_status
    if payload.get("created_at"):
        provider_metadata["provider_created_at"] = payload["created_at"]
    if payload.get("updated_at"):
        provider_metadata["provider_updated_at"] = payload["updated_at"]
    provider_metadata["last_sync_source"] = source

    shutdown_reason = _extract_shutdown_reason(payload)
    if shutdown_reason:
        provider_metadata["shutdown_reason"] = shutdown_reason

    perception_analysis = _extract_perception_analysis(payload)
    if perception_analysis:
        provider_metadata["perception_analysis"] = perception_analysis

    transcript_messages = _extract_transcript(payload)
    fields_to_update = {"provider_metadata", "updated_at"}

    if conversation_status == "active" and session.status == "ready":
        session.status = "in_progress"
        fields_to_update.add("status")

    transcript_ready = False
    if transcript_messages:
        normalized_entries = _replace_transcript_entries(session, transcript_messages)
        _upsert_report(session, normalized_entries, perception_analysis)
        session.transcript_synced_at = timezone.now()
        fields_to_update.add("transcript_synced_at")

        if conversation_status == "ended" and session.ended_at is None:
            session.ended_at = timezone.now()
            fields_to_update.add("ended_at")
            _update_duration(session)
            fields_to_update.add("duration_seconds")

        if session.ended_at:
            session.status = "completed"
        else:
            session.status = "in_progress"
        fields_to_update.add("status")
        transcript_ready = True
    elif conversation_status == "ended" and session.status not in {"completed", "error"}:
        if session.ended_at is None:
            session.ended_at = timezone.now()
            fields_to_update.add("ended_at")
            _update_duration(session)
            fields_to_update.add("duration_seconds")
        session.status = "processing"
        fields_to_update.add("status")

    session.provider_metadata = provider_metadata
    session.last_error = ""
    fields_to_update.add("last_error")
    session.save(update_fields=sorted(fields_to_update))
    return transcript_ready


def _sync_session_from_tavus(
    session: AIInterviewSession,
    *,
    wait_for_transcript: bool = False,
    timeout_seconds: int = 0,
) -> bool:
    if not session.tavus_conversation_id:
        return False

    client = get_tavus_client()
    deadline = time.monotonic() + max(0, timeout_seconds)

    while True:
        try:
            payload = client.get_conversation(session.tavus_conversation_id, verbose=True)
        except TavusAPIError as exc:
            session.last_error = str(exc)
            session.save(update_fields=["last_error", "updated_at"])
            logger.warning("Failed to sync Tavus conversation %s: %s", session.tavus_conversation_id, exc)
            return False

        transcript_ready = _apply_tavus_payload(session, payload, source="poll")
        if transcript_ready or not wait_for_transcript or time.monotonic() >= deadline:
            return transcript_ready
        time.sleep(2)


def _serialize_session_status(session: AIInterviewSession) -> Dict[str, Any]:
    report = AIPerformanceReport.objects.filter(session=session).first()
    transcript_ready = session.transcript_entries.exists()
    meeting_token = str((session.provider_metadata or {}).get("meeting_token", ""))

    return {
        "session_id": str(session.session_id),
        "conversation_id": session.tavus_conversation_id,
        "status": session.status,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "duration_seconds": session.duration_seconds,
        "skill_topic": session.skill_topic,
        "level": session.level,
        "conversation_url": session.conversation_url,
        "embed_url": _build_embed_url(session.conversation_url, meeting_token),
        "audio_only": bool((session.provider_metadata or {}).get("audio_only", False)),
        "test_mode": session.is_test_mode,
        "transcript_ready": transcript_ready,
        "report_ready": report is not None,
        "report": _serialize_report(report),
        "last_error": session.last_error or None,
    }


def _end_conversation_if_needed(session: AIInterviewSession) -> None:
    if not session.tavus_conversation_id:
        return

    client = get_tavus_client()
    try:
        client.end_conversation(session.tavus_conversation_id)
    except TavusAPIError as exc:
        # Ending an already-ended conversation should not poison the whole flow.
        logger.warning("Unable to end Tavus conversation %s: %s", session.tavus_conversation_id, exc)
        session.last_error = str(exc)
        session.save(update_fields=["last_error", "updated_at"])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def start_interview(request) -> Response:
    skill_topic = str(request.data.get("skill_topic", "")).strip()
    level = str(request.data.get("level", "intermediate")).strip().lower()

    if not skill_topic:
        return Response({"error": "skill_topic is required"}, status=status.HTTP_400_BAD_REQUEST)
    if level not in VALID_LEVELS:
        return Response({"error": "level must be beginner, intermediate, or advanced"}, status=status.HTTP_400_BAD_REQUEST)

    duration_minutes_raw = request.data.get("duration_minutes", 25)
    try:
        duration_minutes = max(5, int(duration_minutes_raw))
    except (TypeError, ValueError):
        return Response({"error": "duration_minutes must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    audio_only = _parse_bool(request.data.get("audio_only"), default=False)
    test_mode_override = request.data.get("test_mode")
    test_mode = _parse_bool(test_mode_override) if test_mode_override is not None else get_tavus_client().config.test_mode

    cv_text = ""
    cv_file = request.data.get("cv_file")
    if cv_file is not None:
        cv_text = parse_cv(cv_file.read(), cv_file.name)

    session_uuid = uuid.uuid4()
    system_prompt = build_interview_prompt(
        skill_topic=skill_topic,
        level=level,
        cv_text=cv_text,
        duration_minutes=duration_minutes,
    )
    conversational_context = build_conversational_context(
        skill_topic=skill_topic,
        level=level,
        cv_text=cv_text,
    )

    client = get_tavus_client()
    callback_url = _build_callback_url()

    try:
        persona_reused = bool(client.config.persona_id)
        if persona_reused:
            persona_id = client.config.persona_id
        else:
            persona = client.create_persona(
                name=f"SkillMeter Interview {str(session_uuid)[:8]}",
                system_prompt=system_prompt,
            )
            persona_id = persona["persona_id"]

        conversation = client.create_conversation(
            persona_id=persona_id,
            conversation_name=f"SkillMeter {skill_topic} {str(session_uuid)[:8]}",
            conversational_context=conversational_context,
            custom_greeting=f"Hi, I'm your SkillMeter interviewer for {skill_topic}. Let's get started.",
            callback_url=callback_url,
            audio_only=audio_only,
            test_mode=test_mode,
        )
    except TavusAPIError as exc:
        logger.error("Failed to start Tavus interview: %s", exc, exc_info=True)
        return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    provider_metadata = {
        "audio_only": audio_only,
        "meeting_token": conversation.get("meeting_token", ""),
        "callback_url": callback_url,
        "conversation_status": conversation.get("status", "active"),
        "persona_reused": persona_reused,
    }

    ai_session = AIInterviewSession.objects.create(
        session_id=session_uuid,
        user=request.user,
        skill_topic=skill_topic,
        level=level,
        cv_text=cv_text,
        system_prompt=system_prompt,
        tavus_persona_id=persona_id,
        tavus_conversation_id=conversation.get("conversation_id"),
        conversation_url=conversation.get("conversation_url"),
        status="ready",
        is_test_mode=test_mode,
        provider_metadata=provider_metadata,
    )

    return Response(
        {
            "session_id": str(ai_session.session_id),
            "conversation_id": ai_session.tavus_conversation_id,
            "conversation_url": ai_session.conversation_url,
            "embed_url": _build_embed_url(
                ai_session.conversation_url,
                str(provider_metadata.get("meeting_token", "")),
            ),
            "status": ai_session.status,
            "audio_only": audio_only,
            "test_mode": test_mode,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def end_interview(request, session_id: str) -> Response:
    session = _get_owned_session(session_id, request.user)
    if not session:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    await_report = _parse_bool(request.data.get("await_report"), default=True)
    callback_url = str((session.provider_metadata or {}).get("callback_url", "")).strip()
    can_finalize_async = bool(callback_url)

    if session.status == "completed":
        return Response(_serialize_session_status(session))

    if session.ended_at is None:
        session.ended_at = timezone.now()
    _update_duration(session)
    session.status = "processing"
    session.save(update_fields=["ended_at", "duration_seconds", "status", "updated_at"])

    _end_conversation_if_needed(session)

    if not await_report and can_finalize_async:
        response_data = _serialize_session_status(session)
        response_data["message"] = "Interview ended. Transcript and report will finish syncing asynchronously."
        return Response(response_data, status=status.HTTP_202_ACCEPTED)

    transcript_ready = _sync_session_from_tavus(session, wait_for_transcript=True, timeout_seconds=16)

    response_data = _serialize_session_status(session)
    if transcript_ready and response_data["report_ready"]:
        return Response(response_data)

    response_data["message"] = "Interview ended. Tavus is still finalizing the transcript."
    return Response(response_data, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session_status(request, session_id: str) -> Response:
    session = _get_owned_session(session_id, request.user)
    if not session:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if session.status in {"ready", "in_progress", "processing"}:
        _sync_session_from_tavus(session, wait_for_transcript=False, timeout_seconds=0)

    return Response(_serialize_session_status(session))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_transcript(request, session_id: str) -> Response:
    session = _get_owned_session(session_id, request.user)
    if not session:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if not session.transcript_entries.exists() and session.tavus_conversation_id:
        _sync_session_from_tavus(session, wait_for_transcript=False, timeout_seconds=0)

    entries = [
        {
            "speaker": entry.speaker,
            "text": entry.text,
            "timestamp": entry.timestamp.isoformat(),
            "sequence": entry.sequence_number,
        }
        for entry in session.transcript_entries.all().order_by("sequence_number")
    ]

    return Response(
        {
            "session_id": str(session.session_id),
            "entries": entries,
            "report": _serialize_report(AIPerformanceReport.objects.filter(session=session).first()),
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def tavus_callback(request) -> Response:
    client = get_tavus_client()
    expected_token = client.config.callback_secret
    received_token = str(request.query_params.get("token", "")).strip()
    if expected_token and received_token != expected_token:
        return Response({"error": "Invalid callback token"}, status=status.HTTP_403_FORBIDDEN)

    conversation_id = str(request.data.get("conversation_id", "")).strip()
    if not conversation_id:
        return Response({"error": "conversation_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    session = AIInterviewSession.objects.filter(tavus_conversation_id=conversation_id).first()
    if not session:
        logger.warning("Ignoring Tavus callback for unknown conversation %s", conversation_id)
        return Response({"status": "ignored"}, status=status.HTTP_202_ACCEPTED)

    event_type = str(request.data.get("event_type", "")).strip().lower()
    provider_metadata = dict(session.provider_metadata or {})
    provider_metadata["last_callback_event"] = event_type
    provider_metadata["last_callback_at"] = request.data.get("timestamp")

    shutdown_reason = _extract_shutdown_reason(request.data)
    if shutdown_reason:
        provider_metadata["shutdown_reason"] = shutdown_reason

    session.provider_metadata = provider_metadata

    update_fields = {"provider_metadata", "updated_at"}
    if event_type == "system.replica_joined" and session.status == "ready":
        session.status = "in_progress"
        update_fields.add("status")
    elif event_type == "system.shutdown" and session.status not in {"completed", "error"}:
        if session.ended_at is None:
            session.ended_at = timezone.now()
            update_fields.add("ended_at")
            _update_duration(session)
            update_fields.add("duration_seconds")
        session.status = "processing"
        update_fields.add("status")

    session.save(update_fields=sorted(update_fields))

    if event_type in {"application.transcription_ready", "application.perception_analysis"}:
        _apply_tavus_payload(session, request.data, source="callback")

    return Response({"status": "ok"})
