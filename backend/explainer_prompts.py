"""
NeuroCardiology AI Explainer - Prompts, Parsing & Sample Clinical Reports.

Provides specialized prompts and report parsing for:
1. Target Audiences: Doctor/Clinician vs. Patient/Family
2. Explainer Modes: Static Structured Breakdown vs. Interactive Conversational Video Interface (CVI)
3. Frontend File Upload & Text Parsing
"""

from __future__ import annotations
import io
import re
from typing import Dict, Any, List

# Sample Neurocardiology Clinical Reports for Quick Testing/Preset selection
SAMPLE_REPORTS: Dict[str, Dict[str, Any]] = {
    "pots_dysautonomia": {
        "title": "Postural Orthostatic Tachycardia Syndrome (POTS) & Autonomic Function Test",
        "patient_age": 28,
        "patient_gender": "Female",
        "referring_physician": "Dr. E. Vance, Neurology",
        "date": "2026-07-15",
        "text": """
EXAMINATION: Comprehensive Autonomic Function Testing & Tilt Table Evaluation

CLINICAL INDICATION: Recurrent lightheadedness, exercise intolerance, palpitations upon standing, post-exertional fatigue. Suspected Dysautonomia.

FINDINGS:
1. RESTING PARAMETERS:
   - Supine Heart Rate: 64 bpm, Supine BP: 118/74 mmHg.
   - 10-Minute Head-Up Tilt (HUT) Test: HR increased from 64 bpm to 112 bpm (+48 bpm spike) within 3 minutes of standing.
   - BP during tilt: 114/72 mmHg (No significant orthostatic hypotension observed).

2. CARDIOVAGAL & ADRENERGIC FUNCTION:
   - Deep Breathing E:I Ratio: 1.18 (Borderline low vagal tone).
   - Valsalva Maneuver: Phase II exaggerated BP drop with delayed recovery; Phase IV overshoot absent.
   - Quantitative Sudomotor Axon Reflex Test (QSART): Reduced sweat volume in distal lower extremity (forearm: 0.42 ul/cm2, foot: 0.11 ul/cm2).

3. HEART RATE VARIABILITY (HRV):
   - Low Frequency (LF) / High Frequency (HF) Power Ratio: 3.4 (Elevated sympathetic predominance upon orthostatic stress).

IMPRESSION / DIAGNOSIS:
1. Findings highly consistent with Postural Orthostatic Tachycardia Syndrome (POTS), hyperadrenergic variant component.
2. Mild distal small fiber sudomotor neuropathy noted on QSART.

RECOMMENDATIONS:
- Increase dietary sodium (6-10g/day) and fluid intake (2.5-3L/day).
- Commence graded compression garments (30-40 mmHg waist-high).
- Consider low-dose Beta-blocker (e.g., Propranolol 10mg TID) or Ivabradine for rate control.
- Structured Levine Protocol cardiac rehabilitation exercise program.
"""
    },
    "vasovagal_syncope": {
        "title": "Neurocardiogenic (Vasovagal) Syncope & Baroreflex Sensitivity Report",
        "patient_age": 42,
        "patient_gender": "Male",
        "referring_physician": "Dr. R. Chen, Cardiology",
        "date": "2026-07-22",
        "text": """
EXAMINATION: Autonomic Reflex Screen & Continuous ECG/BP Syncope Evaluation

CLINICAL INDICATION: Three episodes of sudden transient loss of consciousness (TLOC) preceded by diaphoresis, tunnel vision, and nausea, usually triggered by prolonged standing or blood draw.

FINDINGS:
1. HEAD-UP TILT TEST (HUTT):
   - Baseline HR: 72 bpm, BP: 122/80 mmHg.
   - At Minute 18 of tilt, sudden precipitous drop in Heart Rate to 34 bpm (Sinus Bradycardia) accompanied by BP drop to 70/40 mmHg.
   - Reproducible syncope triggered. Patient restored to supine position with rapid recovery of consciousness within 20 seconds.

2. BAROREFLEX SENSITIVITY (BRS):
   - Sequence method BRS: 4.2 ms/mmHg (Depressed baroreflex buffering capability).

3. CONTINUOUS ECG / CARDIAC MONITORING:
   - No intrinsic sinus node dysfunction or AV block at rest. 24-hr Holter showed normal circadian rhythm.

IMPRESSION:
- Classic Neurocardiogenic (Vasovagal) Syncope - Mixed Type 3 (Cardioinhibitory & Vasodepressor response).

RECOMMENDATIONS:
- Counter-pressure maneuvers (leg crossing, hand grip) at aura onset.
- Physical tilt training & hydration maintenance.
- Midodrine consideration if refractory to conservative measures. Dual-chamber pacing low priority unless severe sinus pauses >6s recur.
"""
    },
    "stroke_afib_correlate": {
        "title": "Cardioembolic Stroke Risk & Autonomic Cardiac Neuro-Evaluation",
        "patient_age": 67,
        "patient_gender": "Female",
        "referring_physician": "Dr. M. Patel, Stroke Neurology",
        "date": "2026-07-28",
        "text": """
EXAMINATION: Brain MRI + 14-Day Patch ECG & Autonomic Risk Profile

CLINICAL INDICATION: Recent transient ischemic attack (TIA) left MCA territory. Evaluation of autonomic cardiac stroke risk factors and paroxysmal atrial fibrillation (pAFib).

FINDINGS:
1. BRAIN MRI: Embolic-appearing acute cortical micro-infarct in the left parietal cortex. No significant carotid stenosis on CTA.
2. EXTENDED AMBULATORY ECG: Detected 3 episodes of asymptomatic Paroxysmal Atrial Fibrillation (longest duration: 42 minutes, highest ventricular rate: 138 bpm).
3. AUTONOMIC & HRV ANALYSIS:
   - RMSSD: 12 ms (Markedly reduced vagal cardiac protection).
   - Heart Rate Turbulence (HRT): Impaired Turbulence Slope (TS = 1.1 ms/RR), indicative of autonomic impairment following ectopic beats.

IMPRESSION:
1. Cardioembolic TIA secondary to newly identified Paroxysmal Atrial Fibrillation (CHA2DS2-VASc Score = 4).
2. Autonomic cardiac imbalance with suppressed parasympathetic tone.

RECOMMENDATIONS:
- Initiate oral anticoagulation (DOAC: Apixaban 5mg BID).
- Rate control optimization (Metoprolol Succinate).
- Repeat neurological follow-up in 4 weeks.
"""
    }
}


def parse_uploaded_report_file(file_bytes: bytes, filename: str) -> str:
    """
    Parses an uploaded NeuroCardiology report file (TXT, PDF, or Markdown).
    Extracts raw text content for AI processing.
    """
    filename_lower = filename.lower()
    
    if filename_lower.endswith(".pdf"):
        try:
            # Simple PDF text extraction if pypdf or PyPDF2 is installed
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_pages = [page.extract_text() for page in reader.pages if page.extract_text()]
            extracted = "\n".join(text_pages).strip()
            if extracted:
                return extracted
        except Exception:
            pass
        
        # Fallback regex string extraction for basic PDF bytes if pypdf is unavailable
        try:
            raw_str = file_bytes.decode("latin-1", errors="ignore")
            lines = re.findall(r"\((.*?)\)\s*Tj", raw_str)
            if lines:
                return "\n".join(lines).strip()
        except Exception:
            pass

    # Default text / utf-8 decoding for .txt, .md, .csv or generic files
    try:
        return file_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="ignore").strip()


def build_static_explainer_prompt(target_audience: str, report_text: str) -> str:
    """
    Builds a prompt for generating a structured static NeuroCardiology explanation.
    """
    is_doctor = target_audience.lower() == "doctor"
    
    if is_doctor:
        return f"""You are an expert Senior NeuroCardiologist reviewing a patient report for a fellow Physician/Clinician.

Analyze the following NeuroCardiology Report:

---
REPORT CONTENT:
{report_text}
---

Provide a structured clinical summary with the following sections:
1. **Executive Clinical Summary**: High-level diagnostic synthesis.
2. **Key Neuro-Cardiac Metrics**: Autonomic function values, HRV parameters, Tilt test results, ECG/EEG markers.
3. **Pathophysiological Mechanisms**: Deep explanation of brain-heart interactions, sympathetic/parasympathetic dysregulation, or autonomic neuropathy.
4. **Clinical Action Plan & Diagnostic Recommendations**: Pharmacotherapy options, further electrophysiological tests, or lifestyle interventions.
5. **Risk Stratification**: Syncope/Stroke/Arrhythmia risk scores and monitoring suggestions.

Maintain rigorous medical precision and clinical terminology (e.g. BRS, QSART, RMSSD, HUTT).
"""
    else:
        return f"""You are a compassionate, expert NeuroCardiology Patient Educator explaining a medical report to a Patient and their family.

Analyze the following NeuroCardiology Report:

---
REPORT CONTENT:
{report_text}
---

Provide an easy-to-understand, reassuring explanation with the following sections:
1. **Simple Summary**: What this report means in plain, friendly language (no confusing medical jargon).
2. **How Your Brain & Heart Interact**: A simple analogy (e.g. comparing the autonomic nervous system to an automatic thermostat controlling your heart rate and blood pressure).
3. **Main Findings Made Easy**: Break down the key test results into simple bullet points.
4. **Action Steps For You**: Clear daily lifestyle tips (hydration, sodium intake, compression socks, gentle exercise) and questions to ask your doctor.
5. **Reassurance & Key Takeaway**: Warm, comforting summary emphasizing that you have a clear path forward.

Keep the tone supportive, clear, reassuring, and completely jargon-free.
"""


def build_cvi_tavus_system_prompt(target_audience: str, report_text: str) -> str:
    """
    Builds the Tavus AI Persona System Prompt for the Interactive Conversational Video Interface (CVI).
    """
    is_doctor = target_audience.lower() == "doctor"
    
    if is_doctor:
        return f"""You are Dr. Ava Vance, an AI Specialist in NeuroCardiology and Autonomic Disorders. You are conducting a live video consultation with an attending Doctor / Clinician regarding their patient's neurocardiology report.

PATIENT REPORT DATA:
{report_text}

YOUR CONVERSATIONAL ROLE & BEHAVIOR:
- You speak as a peer medical specialist: professional, concise, medically precise, and articulate.
- Reference specific metrics from the report when asked (e.g. HUTT HR response, QSART values, BRS, RMSSD, LF/HF ratios, pAFib episodes).
- Answer questions on differential diagnoses, treatment protocols (e.g., beta-blockers, fludrocortisone, ivabradine, DOACs, Levine protocol), and risk stratification.
- Keep your conversational responses concise (2-4 sentences per response) so the live video dialogue feels natural and fluid.
- If the doctor asks for a summary, give a 3-sentence clinical executive overview.
"""
    else:
        return f"""You are Dr. Ava Vance, a friendly and empathetic AI NeuroCardiology Specialist. You are holding a live video chat with a patient to explain their recent neurocardiology and heart-brain test results.

PATIENT REPORT DATA YOU ARE EXPLAINING:
{report_text}

YOUR CONVERSATIONAL ROLE & BEHAVIOR:
- Speak in warm, simple, encouraging language. Avoid heavy medical jargon; explain concepts simply (e.g. "Your autonomic system is like your body's automatic control center...").
- Reassure the patient while answering any questions they have about their symptoms (like dizzy spells, rapid heart rate, or fatigue).
- Provide practical daily advice (drinking fluids, standing up slowly, wearing compression socks, taking recommended medications).
- Keep your answers brief, engaging, and spoken naturally (2-3 sentences at a time) for smooth video conversation.
- Always check in with the patient: "Does that make sense?" or "How have you been feeling when standing up?"
"""


def get_cvi_custom_greeting(target_audience: str) -> str:
    """
    Returns the initial greeting spoken by the Tavus AI Avatar when the CVI session starts.
    """
    if target_audience.lower() == "doctor":
        return "Hello Doctor. I've analyzed the patient's neurocardiology and autonomic evaluation report. What aspects of the test results or clinical management would you like to discuss first?"
    else:
        return "Hello! I'm Dr. Ava, your AI NeuroCardiology Specialist. I've reviewed your test report, and I'm here to explain everything in plain language and answer any questions you have. How are you feeling today?"
