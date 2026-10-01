from google import genai
from pydantic_settings import BaseSettings


class GeminiSettings(BaseSettings):

    GEMINI_API_KEY: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = GeminiSettings()


client = genai.Client(
    api_key=settings.GEMINI_API_KEY
)


def analyze_with_ai(
    resume_text,
    job_description,
    missing_skills
):

    prompt = f"""
You are an AI career assistant.

Analyze the following resume and job description.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

MISSING SKILLS:
{", ".join(missing_skills)}

Provide:

1. A short resume summary
2. Explanation of the major skill gaps
3. Three practical suggestions to improve the resume
4. A personalized learning roadmap for the missing skills

Keep the response practical and suitable for a fresher.
"""

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt
    )

    return response.text