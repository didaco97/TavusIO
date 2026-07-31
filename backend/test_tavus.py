from __future__ import annotations

import json
import os
import sys

import requests
from dotenv import load_dotenv


def main() -> int:
    load_dotenv()

    api_key = os.getenv("TAVUS_API_KEY", "").strip()
    replica_id = os.getenv("TAVUS_REPLICA_ID", "").strip()

    if not api_key or not replica_id:
        print("Set TAVUS_API_KEY and TAVUS_REPLICA_ID before running this script.")
        return 1

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }

    print("=== Test 1: List Replicas ===")
    replicas_response = requests.get("https://tavusapi.com/v2/replicas", headers=headers, timeout=30)
    print(f"Status: {replicas_response.status_code}")
    print(f"Response: {replicas_response.text[:500]}")
    print()

    print("=== Test 2: Create Persona ===")
    persona_payload = {
        "persona_name": "Test_Interviewer",
        "system_prompt": "You are a test interviewer.",
        "default_replica_id": replica_id,
        "layers": {
            "transport": {
                "microphone": False,
            }
        },
    }
    print(f"Payload: {json.dumps(persona_payload, indent=2)}")
    persona_response = requests.post(
        "https://tavusapi.com/v2/personas",
        headers=headers,
        json=persona_payload,
        timeout=30,
    )
    print(f"Status: {persona_response.status_code}")
    print(f"Response: {persona_response.text}")

    with open("tavus_test_result.txt", "w", encoding="utf-8") as handle:
        handle.write(f"Replicas Status: {replicas_response.status_code}\n")
        handle.write(f"Persona Status: {persona_response.status_code}\n")
        handle.write(f"Persona Response:\n{persona_response.text}\n")

    print("\nResults written to tavus_test_result.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
