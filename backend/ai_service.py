from google import genai
from pydantic_settings import BaseSettings


# =========================================================
# GEMINI SETTINGS
# =========================================================

class GeminiSettings(BaseSettings):

    GEMINI_API_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = GeminiSettings()


# =========================================================
# GEMINI CLIENT
# =========================================================

client = genai.Client(
    api_key=settings.GEMINI_API_KEY
)


# =========================================================
# AI RESUME ANALYSIS
# =========================================================

def analyze_with_ai(
    resume_text,
    job_description,
    missing_skills
):

    missing_skills_text = ", ".join(missing_skills)

    if not missing_skills_text:
        missing_skills_text = "No major missing skills detected."


    prompt = f"""
You are an AI Career Assistant specialized in helping
freshers prepare for Data Engineering, Data Analyst,
Python and AI/ML roles.

Analyze the candidate's resume against the job description.

========================
RESUME
========================

{resume_text}


========================
JOB DESCRIPTION
========================

{job_description}


========================
MISSING SKILLS
========================

{missing_skills_text}


========================
TASK
========================

Provide a practical and personalized analysis.

Use the following sections:

1. RESUME STRENGTHS
- Mention the candidate's relevant skills and technologies.
- Focus only on skills actually present in the resume.

2. SKILL GAPS
- Explain the important missing skills.
- Explain why each missing skill may matter for this job.

3. RESUME IMPROVEMENTS
Give 3-5 practical suggestions to improve the resume.

Suggestions can include:
- Adding measurable project results
- Improving project descriptions
- Adding relevant technical keywords
- Improving the technical skills section
- Making experience bullets more relevant

Do NOT suggest adding a skill if there is no evidence
that the candidate actually knows it.

4. LEARNING ROADMAP
Create a beginner-friendly roadmap for the missing skills.

Divide it into:

Phase 1: Immediate learning
Phase 2: Practice
Phase 3: Project
Phase 4: Job preparation

5. PROJECT SUGGESTION
Suggest 1 practical project that would help the candidate
demonstrate the missing skills.

6. FINAL SUMMARY
Give a short 3-5 line summary of what the candidate
should focus on next.

IMPORTANT RULES:

- Keep the advice practical.
- Assume the candidate is a fresher.
- Do not invent experience.
- Do not claim that the candidate has skills that are
  not present in the resume.
- Prioritize skills that appear in the job description.
- Keep the response easy to understand.
"""


    # =====================================================
    # GEMINI REQUEST
    # =====================================================

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt
    )


    # =====================================================
    # RETURN AI RESPONSE
    # =====================================================

    return response.text