from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pymupdf
from pydantic import BaseModel

from ai_service import analyze_with_ai
from database import engine, Base, SessionLocal
import models


# ---------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------

app = FastAPI(
    title="AI Resume Analyzer",
    description="Analyze resume against job description using Python, SQL and Gemini AI",
    version="1.0.0"
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",  "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Create Database Tables
# ---------------------------------------------------------

Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# Skills and Related Terms
# ---------------------------------------------------------

SKILL_ALIASES = {

    "python": [
        "python",
    ],

    "sql": [
        "sql",
        "sql queries",
        "sql database",
    ],

    "mysql": [
        "mysql",
    ],

    "postgresql": [
        "postgresql",
        "postgres",
    ],

    "mongodb": [
        "mongodb",
        "mongo db",
        "mongo",
    ],

    "pandas": [
        "pandas",
    ],

    "numpy": [
        "numpy",
    ],

    "fastapi": [
        "fastapi",
    ],

    "flask": [
        "flask",
    ],

    "django": [
        "django",
    ],

    "etl": [
        "etl",
        "extract transform load",
        "extract, transform, load",
    ],

    "data engineering": [
        "data engineering",
        "data engineer",
        "data pipeline",
        "data pipelines",
        "data processing pipeline",
    ],

    "machine learning": [
        "machine learning",
        "machine-learning",
        "ml",
    ],

    "scikit-learn": [
        "scikit-learn",
        "scikit learn",
        "sklearn",
    ],

    "tensorflow": [
        "tensorflow",
    ],

    "pytorch": [
        "pytorch",
        "torch",
    ],

    "spark": [
        "spark",
        "apache spark",
    ],

    "pyspark": [
        "pyspark",
    ],

    "aws": [
        "aws",
        "amazon web services",
    ],

    "azure": [
        "azure",
        "microsoft azure",
    ],

    "gcp": [
        "gcp",
        "google cloud",
        "google cloud platform",
    ],

    "docker": [
        "docker",
        "containerization",
        "containers",
    ],

    "git": [
        "git",
        "version control",
    ],

    "github": [
        "github",
    ],

    "rest api": [
        "rest api",
        "rest apis",
        "restful api",
        "restful apis",
    ],

    "power bi": [
        "power bi",
        "powerbi",
    ],

    "tableau": [
        "tableau",
    ],
}


# ---------------------------------------------------------
# Normalize Text
# ---------------------------------------------------------

def normalize_text(text):
    """
    Convert text into a simpler format
    for better skill matching.
    """

    text = text.lower()

    replacements = {
        "-": " ",
        "_": " ",
        "/": " ",
        "(": " ",
        ")": " ",
        ",": " ",
        ".": " ",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return " ".join(text.split())


# ---------------------------------------------------------
# Extract Skills
# ---------------------------------------------------------

def extract_skills(text):
    """
    Detect skills using skill aliases.

    Example:
    PostgreSQL or Postgres
    -> PostgreSQL
    """

    normalized_text = normalize_text(text)

    found_skills = []

    for skill, aliases in SKILL_ALIASES.items():

        for alias in aliases:

            normalized_alias = normalize_text(alias)

            if normalized_alias in normalized_text:

                found_skills.append(skill)

                break

    return found_skills


# ---------------------------------------------------------
# Home Route
# ---------------------------------------------------------

@app.get("/")
def home():

    return {
        "message": "AI Resume Analyzer API is running!"
    }


# ---------------------------------------------------------
# Upload Resume
# ---------------------------------------------------------

@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):

    contents = await file.read()

    pdf = pymupdf.open(
        stream=contents,
        filetype="pdf"
    )

    text = ""

    for page in pdf:
        text += page.get_text()

    pdf.close()

    return {
        "filename": file.filename,
        "text": text
    }


# ---------------------------------------------------------
# Job Description
# ---------------------------------------------------------

class JobDescription(BaseModel):

    text: str


@app.post("/job-description")
def add_job_description(job: JobDescription):

    return {
        "message": "Job description received successfully",
        "job_description": job.text
    }


# ---------------------------------------------------------
# Resume Match Request
# ---------------------------------------------------------

class ResumeMatchRequest(BaseModel):

    resume_text: str
    job_description: str


# ---------------------------------------------------------
# Analyze Resume
# ---------------------------------------------------------

@app.post("/analyze")
def analyze_resume(data: ResumeMatchRequest):

    # ---------------------------------------------
    # Extract skills from resume
    # ---------------------------------------------

    resume_skills = extract_skills(
        data.resume_text
    )

    # ---------------------------------------------
    # Extract skills from job description
    # ---------------------------------------------

    jd_skills = extract_skills(
        data.job_description
    )

    # ---------------------------------------------
    # Find matched skills
    # ---------------------------------------------

    matched_skills = [
        skill
        for skill in jd_skills
        if skill in resume_skills
    ]

    # ---------------------------------------------
    # Find missing skills
    # ---------------------------------------------

    missing_skills = [
        skill
        for skill in jd_skills
        if skill not in resume_skills
    ]

    # ---------------------------------------------
    # Calculate Match Percentage
    # ---------------------------------------------

    if len(jd_skills) > 0:

        match_percentage = round(
            len(matched_skills)
            / len(jd_skills)
            * 100,
            2
        )

    else:

        match_percentage = 0

    # ---------------------------------------------
    # Gemini AI Analysis
    # ---------------------------------------------

    ai_result = analyze_with_ai(
        data.resume_text,
        data.job_description,
        missing_skills
    )

    # ---------------------------------------------
    # Save Analysis to Database
    # ---------------------------------------------

    db = SessionLocal()

    try:

        analysis = models.ResumeAnalysis(

            resume_text=data.resume_text,

            job_description=data.job_description,

            match_percentage=match_percentage,

            matched_skills=", ".join(
                matched_skills
            ),

            missing_skills=", ".join(
                missing_skills
            ),

            ai_analysis=ai_result
        )

        db.add(analysis)

        db.commit()

        db.refresh(analysis)

        # -----------------------------------------
        # Return Result
        # -----------------------------------------

        return {

            "id": analysis.id,

            "resume_skills": resume_skills,

            "job_description_skills": jd_skills,

            "matched_skills": matched_skills,

            "missing_skills": missing_skills,

            "match_percentage": match_percentage,

            "ai_analysis": ai_result,

            "message": "Analysis saved successfully"
        }

    finally:

        db.close()


# ---------------------------------------------------------
# Analysis History
# ---------------------------------------------------------

@app.get("/history")
def get_analysis_history():

    db = SessionLocal()

    try:

        analyses = (
            db.query(
                models.ResumeAnalysis
            )
            .order_by(
                models.ResumeAnalysis.id.desc()
            )
            .all()
        )

        return [

            {
                "id": analysis.id,

                "match_percentage":
                    analysis.match_percentage,

                "matched_skills":
                    analysis.matched_skills,

                "missing_skills":
                    analysis.missing_skills,

                "ai_analysis":
                    analysis.ai_analysis
            }

            for analysis in analyses

        ]

    finally:

        db.close()

# ---------------------------------------------------------
# Delete Analysis
# ---------------------------------------------------------

@app.delete("/history/{analysis_id}")
def delete_analysis(analysis_id: int):

    db = SessionLocal()

    try:
        analysis = (
            db.query(models.ResumeAnalysis)
            .filter(
                models.ResumeAnalysis.id == analysis_id
            )
            .first()
        )

        if not analysis:
            return {
                "message": "Analysis not found"
            }

        db.delete(analysis)
        db.commit()

        return {
            "message": "Analysis deleted successfully",
            "id": analysis_id
        }

    finally:
        db.close()