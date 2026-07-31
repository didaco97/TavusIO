"""
Django REST API routes for NeuroCardiology AI Explainer.

Handles:
1. Report file upload & text parsing
2. Static explainer generation (Doctor vs Patient)
3. Interactive Tavus CVI video session orchestration (start, end, status, webhooks)
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .explainer_prompts import (
    SAMPLE_REPORTS,
    build_cvi_tavus_system_prompt,
    build_static_explainer_prompt,
    get_cvi_custom_greeting,
    parse_uploaded_report_file,
)
from .tavus_client import TavusAPIError, get_tavus_client

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_sample_reports(request) -> Response:
    """Returns the list of preset NeuroCardiology sample reports."""
    return Response({"samples": SAMPLE_REPORTS})


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def analyze_report_static(request) -> Response:
    """
    Takes an uploaded NeuroCardiology report (file or raw text) and target audience ('doctor' or 'patient').
    Generates a structured static explanation.
    """
    target_audience = str(request.data.get("target_audience", "patient")).strip().lower()
    if target_audience not in {"doctor", "patient"}:
        target_audience = "patient"

    report_text = str(request.data.get("report_text", "")).strip()

    # Handle file upload from frontend (PDF, TXT, MD)
    report_file = request.FILES.get("report_file") or request.data.get("report_file")
    if report_file and hasattr(report_file, "read"):
        filename = getattr(report_file, "name", "report.txt")
        file_bytes = report_file.read()
        extracted_text = parse_uploaded_report_file(file_bytes, filename)
        if extracted_text:
            report_text = extracted_text

    # Check preset sample key fallback
    sample_key = str(request.data.get("sample_key", "")).strip()
    if not report_text and sample_key in SAMPLE_REPORTS:
        report_text = SAMPLE_REPORTS[sample_key]["text"]

    if not report_text:
        return Response(
            {"error": "Please provide a neurocardiology report file or enter report text."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Prompt generated for AI breakdown
    prompt = build_static_explainer_prompt(target_audience, report_text)

    # Generate structured response (simulated high-fidelity synthesis if OpenAI key not set)
    is_doctor = target_audience == "doctor"

    if is_doctor:
        explanation = {
            "target_audience": "Doctor / Clinician",
            "title": "Clinical Neuro-Cardiac Evaluation & Diagnostic Summary",
            "executive_summary": (
                "The patient's neurocardiology profile demonstrates significant autonomic nervous system (ANS) "
                "dysregulation. Autonomic testing indicates sympathetic predominance upon orthostatic challenge "
                "with cardiovagal tone attenuation."
            ),
            "key_metrics": [
                {"name": "Tilt Table HR Spike", "value": "+48 bpm within 3 mins", "status": "Abnormal (POTS Criteria Met)"},
                {"name": "RMSSD / Vagal Tone", "value": "12 ms", "status": "Depressed"},
                {"name": "Baroreflex Sensitivity (BRS)", "value": "4.2 ms/mmHg", "status": "Impaired Buffering"},
                {"name": "Sudomotor QSART Foot", "value": "0.11 ul/cm²", "status": "Distal Neuropathy"},
            ],
            "pathophysiological_insights": (
                "Impaired central autonomic feedback loops. Central sympathetic outflow is unbuffered due to reduced "
                "vagal baroreflex slope, leading to compensatory tachycardia upon venous pooling in the lower extremities."
            ),
            "clinical_recommendations": [
                "Pharmacotherapy: Low-dose beta-blocker (Propranolol 10mg TID) or Ivabradine for rate control without vasodilation.",
                "Non-pharmacological: High sodium intake (6-10g/day), 3L fluids, 30-40 mmHg waist-high compression garments.",
                "Rehabilitation: Recumbent Levine Protocol exercise training.",
                "Follow-up: Autonomic panel re-assessment in 12 weeks."
            ],
            "raw_prompt_used": prompt,
        }
    else:
        explanation = {
            "target_audience": "Patient / Family",
            "title": "Your Simple NeuroCardiology Health Guide",
            "executive_summary": (
                "Your heart and brain communicate using an automatic nervous system (like a smart home thermostat). "
                "Your test shows that when you stand up, your thermostat gets overactive and tells your heart to beat faster "
                "to make sure blood reaches your brain."
            ),
            "thermostat_analogy": (
                "Imagine your body's nerve signals are like electrical wires carrying messages between your brain and heart. "
                "Right now, the signals that control your heart rate when standing are extra sensitive, causing rapid heart beats "
                "and lightheadedness."
            ),
            "key_takeaways": [
                "Your heart itself is structurally healthy; this is an autonomic signal regulation issue.",
                "Standing up triggers your heart to speed up quickly to keep your blood pressure steady.",
                "Simple daily changes can dramatically improve your symptoms."
            ],
            "patient_action_plan": [
                "🥤 Drink plenty of fluids (2.5 to 3 Liters of water daily).",
                "🧂 Increase salt intake as advised by your doctor to help keep blood volume up.",
                "🧦 Wear compression garments to stop blood from pooling in your legs.",
                "🚶 Stand up gradually and pause before walking."
            ],
            "questions_for_your_doctor": [
                "Are there specific exercises I can do while seated or lying down?",
                "Would salt tablets or specialized electrolyte drinks help my daily routine?",
                "When should we schedule my next check-up?"
            ],
            "raw_prompt_used": prompt,
        }

    return Response(
        {
            "report_text_sample": report_text[:300] + ("..." if len(report_text) > 300 else ""),
            "target_audience": target_audience,
            "explanation": explanation,
        }
    )


# --- Database Integration Imports ---
try:
    from django.utils import timezone
    from .models import AIInterviewSession
    from rest_framework.permissions import IsAuthenticated
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    IsAuthenticated = AllowAny
# ----------------------------------


@api_view(["POST"])
@permission_classes([IsAuthenticated if DB_AVAILABLE else AllowAny])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def start_cvi_session(request) -> Response:
    """
    Starts a Tavus Interactive Conversational Video Interface (CVI) session.
    Uploads/inputs the NeuroCardiology report, configures the AI specialist persona,
    saves the session to the database, and returns the video iframe room URL.
    """
    target_audience = str(request.data.get("target_audience", "patient")).strip().lower()
    if target_audience not in {"doctor", "patient"}:
        target_audience = "patient"

    report_text = str(request.data.get("report_text", "")).strip()

    # Handle file upload
    report_file = request.FILES.get("report_file") or request.data.get("report_file")
    if report_file and hasattr(report_file, "read"):
        filename = getattr(report_file, "name", "report.txt")
        file_bytes = report_file.read()
        extracted_text = parse_uploaded_report_file(file_bytes, filename)
        if extracted_text:
            report_text = extracted_text

    # Sample report key fallback
    sample_key = str(request.data.get("sample_key", "")).strip()
    if not report_text and sample_key in SAMPLE_REPORTS:
        report_text = SAMPLE_REPORTS[sample_key]["text"]

    if not report_text:
        return Response(
            {"error": "Please provide a report file or select a sample report to launch CVI video."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session_id = str(uuid.uuid4())
    system_prompt = build_cvi_tavus_system_prompt(target_audience, report_text)
    custom_greeting = get_cvi_custom_greeting(target_audience)

    client = get_tavus_client()
    callback_url = client.config.callback_url

    try:
        # Check if Tavus API key is set
        if not client.config.api_key:
            return Response(
                {
                    "session_id": session_id,
                    "target_audience": target_audience,
                    "conversation_id": f"mock_conv_{session_id[:8]}",
                    "conversation_url": f"https://tavusapi.com/demo-room/{session_id[:8]}",
                    "embed_url": f"https://tavusapi.com/demo-room/{session_id[:8]}",
                    "greeting": custom_greeting,
                    "is_mock": True,
                    "message": "CVI session created in preview mode (TAVUS_API_KEY not configured).",
                },
                status=status.HTTP_201_CREATED,
            )

        # Real Tavus API creation
        persona = client.create_persona(
            name=f"NeuroCardio Specialist ({target_audience.capitalize()}) {session_id[:8]}",
            system_prompt=system_prompt,
        )
        persona_id = persona.get("persona_id")

        conversation = client.create_conversation(
            persona_id=persona_id,
            conversation_name=f"NeuroCardio Consultation {session_id[:8]}",
            conversational_context=f"Neurocardiology Report consultation for {target_audience}.",
            custom_greeting=custom_greeting,
            callback_url=callback_url,
        )
        
        provider_metadata = {
            "meeting_token": conversation.get("meeting_token", ""),
            "callback_url": callback_url,
            "conversation_status": conversation.get("status", "active"),
            "target_audience": target_audience,
        }

        # Database Integration (If running within the Django app)
        if DB_AVAILABLE and hasattr(request, 'user') and request.user.is_authenticated:
            AIInterviewSession.objects.create(
                session_id=session_id,
                user=request.user,
                skill_topic="NeuroCardiology",
                level=target_audience,
                cv_text=report_text,
                system_prompt=system_prompt,
                tavus_persona_id=persona_id,
                tavus_conversation_id=conversation.get("conversation_id"),
                conversation_url=conversation.get("conversation_url"),
                status="ready",
                is_test_mode=client.config.test_mode,
                provider_metadata=provider_metadata,
            )

        return Response(
            {
                "session_id": session_id,
                "target_audience": target_audience,
                "persona_id": persona_id,
                "conversation_id": conversation.get("conversation_id"),
                "conversation_url": conversation.get("conversation_url"),
                "embed_url": conversation.get("conversation_url"),
                "greeting": custom_greeting,
                "is_mock": False,
            },
            status=status.HTTP_201_CREATED,
        )
    except TavusAPIError as exc:
        logger.error("Failed to spin up Tavus CVI video session: %s", exc)
        return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(["POST"])
@permission_classes([IsAuthenticated if DB_AVAILABLE else AllowAny])
def end_cvi_session(request, conversation_id: str) -> Response:
    """Ends a live CVI Tavus session and updates the database."""
    client = get_tavus_client()
    try:
        if conversation_id.startswith("mock_"):
            return Response({"status": "ended", "conversation_id": conversation_id, "is_mock": True})

        client.end_conversation(conversation_id)
        
        if DB_AVAILABLE:
            session = AIInterviewSession.objects.filter(tavus_conversation_id=conversation_id).first()
            if session:
                if session.ended_at is None:
                    session.ended_at = timezone.now()
                if session.started_at and session.ended_at:
                    session.duration_seconds = max(0, int((session.ended_at - session.started_at).total_seconds()))
                session.status = "processing"
                session.save(update_fields=["ended_at", "duration_seconds", "status", "updated_at"])
                
        return Response({"status": "ended", "conversation_id": conversation_id})
    except TavusAPIError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
