# Backend — Python / Django Integration Layer

This `backend/` folder is the **Python/Django integration blueprint** for the NeuroCardiology AI Explainer.

> **Important:** This is **not** the currently running backend in the Vite + Express development setup. The live Express server lives at [`../server.js`](../server.js). This Python layer is designed for deployment within a **Django** project that uses the Django REST Framework (DRF).

---

## 📂 File Reference

| File | Purpose |
|---|---|
| `explainer_prompts.py` | Sample clinical reports (POTS, Vasovagal Syncope, Cardioembolic Stroke), the report file parser (`parse_uploaded_report_file`), and all Tavus system prompt builders. |
| `explainer_routes.py` | Django REST Framework API views (`@api_view`). Handles report analysis and CVI session creation/ending. Optionally integrates with an `AIInterviewSession` Django model if available. |
| `tavus_client.py` | A standalone, dependency-free Python Tavus V2 API client using only `urllib`. Supports persona creation, conversation creation/ending, and replica listing. |
| `test_explainer.py` | CLI test script — validates prompt builders, sample reports, and optionally makes a live Tavus API call. |
| `test_tavus.py` | CLI test script — tests live Tavus API connectivity using `requests`. Requires `TAVUS_API_KEY` and `TAVUS_REPLICA_ID` to be set. |

---

## 🔌 Django URL Routes (when wired into a Django project)

Add the following to your Django `urls.py`:

```python
from django.urls import path
from backend import explainer_routes

urlpatterns = [
    path('api/explainer/sample-reports/', explainer_routes.get_sample_reports),
    path('api/explainer/analyze/', explainer_routes.analyze_report_static),
    path('api/explainer/start-cvi/', explainer_routes.start_cvi_session),
    path('api/explainer/end-cvi/<str:conversation_id>/', explainer_routes.end_cvi_session),
]
```

---

## ⚙️ Environment Variables

The Python Tavus client reads from environment variables (compatible with `python-dotenv`):

| Variable | Required | Description |
|---|---|---|
| `TAVUS_API_KEY` | Yes | Tavus API key |
| `TAVUS_REPLICA_ID` | Recommended | Tavus visual replica ID |
| `TAVUS_PERSONA_ID` | No | Pre-created persona ID (optional override) |
| `TAVUS_BASE_URL` | No | Defaults to `https://tavusapi.com/v2` |
| `TAVUS_CALLBACK_URL` | No | Webhook URL for session status events |
| `TAVUS_CALLBACK_SECRET` | No | Secret to validate Tavus webhook payloads |
| `TAVUS_TEST_MODE` | No | `true` / `false` — enables Tavus test mode |
| `TAVUS_REQUIRE_AUTH` | No | `true` / `false` — require auth on Tavus conversations |
| `TAVUS_TIMEOUT_SECONDS` | No | HTTP timeout in seconds (default: `30`) |
| `TAVUS_MAX_PARTICIPANTS` | No | Max participants per conversation (default: `2`) |

---

## 🧪 Running the Python Tests

These tests run standalone without needing a Django project:

```bash
# Test prompt builders, sample reports, and (optionally) live Tavus API
python backend/test_explainer.py

# Test live Tavus API connectivity (requires TAVUS_API_KEY + TAVUS_REPLICA_ID)
python backend/test_tavus.py
```

---

## 📦 Python Dependencies

The core `tavus_client.py` uses **only Python standard library** (`urllib`, `json`, `os`, `dataclasses`).

For the Django views in `explainer_routes.py`, install:

```bash
pip install djangorestframework
```

For PDF text extraction in `explainer_prompts.py`:

```bash
pip install pypdf
```

For `test_tavus.py`:

```bash
pip install requests python-dotenv
```

---

## 🔁 Relationship to `server.js`

Both `server.js` (Node.js/Express) and `explainer_routes.py` (Python/Django) implement the **same conceptual API** for the NeuroCardiology Explainer. They are alternative backends for different deployment contexts:

| | `server.js` | `explainer_routes.py` |
|---|---|---|
| **Runtime** | Node.js | Python 3.9+ |
| **Framework** | Express | Django REST Framework |
| **Used in** | Vite dev setup, standalone deployment | Django application |
| **Status** | ✅ **Active / live** | 📐 Integration blueprint |
