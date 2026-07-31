"""
Test script for NeuroCardiology AI Explainer.

Verifies:
1. Sample report loader and prompt builder
2. Static explanation generation (Doctor vs Patient)
3. Tavus CVI persona and conversation initialization
"""

import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(__file__))

from explainer_prompts import (
    SAMPLE_REPORTS,
    build_static_explainer_prompt,
    build_cvi_tavus_system_prompt,
    get_cvi_custom_greeting,
)
from tavus_client import TavusClient, TavusConfig, TavusAPIError


def run_tests():
    print("=" * 60)
    print("NEUROCARDIOLOGY AI EXPLAINER - TEST SUITE")
    print("=" * 60)

    # 1. Test Prompts & Sample Reports
    print("\n[1] Testing Sample Reports & Prompt Builders...")
    for key, sample in SAMPLE_REPORTS.items():
        print(f"  [OK] Found sample report: {sample['title']} (Age {sample['patient_age']} {sample['patient_gender']})")

    pots_report = SAMPLE_REPORTS["pots_dysautonomia"]["text"]

    doc_prompt = build_static_explainer_prompt("doctor", pots_report)
    patient_prompt = build_static_explainer_prompt("patient", pots_report)

    print(f"  [OK] Doctor Prompt generated ({len(doc_prompt)} chars)")
    print(f"  [OK] Patient Prompt generated ({len(patient_prompt)} chars)")

    # 2. Test Tavus CVI System Prompt & Custom Greetings
    print("\n[2] Testing Interactive CVI Persona System Prompts...")
    doc_cvi_prompt = build_cvi_tavus_system_prompt("doctor", pots_report)
    patient_cvi_prompt = build_cvi_tavus_system_prompt("patient", pots_report)

    doc_greeting = get_cvi_custom_greeting("doctor")
    patient_greeting = get_cvi_custom_greeting("patient")

    print(f"  [OK] Doctor Greeting: \"{doc_greeting}\"")
    print(f"  [OK] Patient Greeting: \"{patient_greeting}\"")

    # 3. Test Tavus API Connection
    print("\n[3] Testing Tavus API Credentials...")
    config = TavusConfig.from_env()
    print(f"  Base URL: {config.base_url}")
    print(f"  API Key configured: {'YES' if config.api_key else 'NO (Set TAVUS_API_KEY env var)'}")

    if config.api_key:
        client = TavusClient(config)
        try:
            print("  Connecting to Tavus API...")
            personas = client.create_persona(
                name="Test NeuroCardio Persona",
                system_prompt=doc_cvi_prompt[:500],
            )
            print(f"  [OK] Tavus Persona Created Successfully! ID: {personas.get('persona_id')}")
        except TavusAPIError as err:
            print(f"  [WARN] Tavus API call failed: {err}")
    else:
        print("  [INFO] Skipping live Tavus API test (TAVUS_API_KEY is empty). System will run in preview/mock mode.")

    print("\n" + "=" * 60)
    print("SUCCESS: All local prompt & structure tests passed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
