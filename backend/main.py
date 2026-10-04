from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pymupdf
from pydantic import BaseModel
import re

from ai_service import analyze_with_ai
from database import engine, Base, SessionLocal
import models


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="AI Resume Analyzer",
    description="AI Resume Analyzer with ATS scoring, skill matching and Gemini AI",
    version="4.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# SKILL ALIASES
# =========================================================

SKILL_ALIASES = {
    "python": ["python", "python programming", "python language"],
    "c++": ["c++", "cpp", "c plus plus"],
    "java": ["java", "java programming"],

    "sql": [
        "sql",
        "sql queries",
        "sql query",
        "structured query language"
    ],

    "mysql": ["mysql", "mysql database"],

    "postgresql": [
        "postgresql",
        "postgres",
        "postgres database",
        "postgresql database"
    ],

    "mongodb": [
        "mongodb",
        "mongo db",
        "mongo database",
        "mongo"
    ],

    "pandas": ["pandas"],
    "numpy": ["numpy"],

    "fastapi": ["fastapi"],
    "flask": ["flask"],
    "django": ["django", "django framework"],

    "rest api": [
        "rest api",
        "rest apis",
        "restful api",
        "restful apis",
        "rest services"
    ],

    "etl": [
        "etl",
        "extract transform load",
        "extract, transform, load",
        "etl pipeline",
        "etl pipelines"
    ],

    "data engineering": [
        "data engineering",
        "data engineer",
        "data pipeline",
        "data pipelines",
        "data processing pipeline",
        "data processing pipelines"
    ],

    "spark": ["apache spark", "spark"],
    "pyspark": ["pyspark", "python spark"],

    "machine learning": [
        "machine learning",
        "machine-learning",
        "ml"
    ],

    "scikit-learn": [
        "scikit-learn",
        "scikit learn",
        "sklearn"
    ],

    "tensorflow": ["tensorflow"],
    "pytorch": ["pytorch", "torch"],

    "aws": ["aws", "amazon web services"],
    "azure": ["azure", "microsoft azure"],
    "gcp": [
        "gcp",
        "google cloud",
        "google cloud platform"
    ],

    "docker": [
        "docker",
        "containerization",
        "containerization technology"
    ],

    "git": [
        "git",
        "version control",
        "version-control"
    ],

    "github": [
        "github",
        "github repository",
        "github repositories"
    ],

    "power bi": ["power bi", "powerbi"],
    "tableau": ["tableau"],
}


# =========================================================
# SKILL WEIGHTS
# =========================================================

SKILL_WEIGHTS = {
    "python": 1.5,
    "sql": 1.5,
    "data engineering": 1.5,
    "etl": 1.4,
    "pyspark": 1.4,
    "spark": 1.3,

    "pandas": 1.2,
    "numpy": 1.0,

    "mysql": 1.0,
    "postgresql": 1.0,
    "mongodb": 1.0,

    "aws": 1.2,
    "azure": 1.2,
    "gcp": 1.2,

    "machine learning": 1.2,
    "scikit-learn": 1.1,
    "tensorflow": 1.1,
    "pytorch": 1.1,

    "fastapi": 1.0,
    "flask": 1.0,
    "django": 1.0,
    "rest api": 1.0,

    "git": 0.8,
    "github": 0.8,
    "docker": 1.0,

    "power bi": 1.0,
    "tableau": 1.0,

    "c++": 1.0,
    "java": 1.0,
}


# =========================================================
# RELATED SKILLS
# =========================================================

RELATED_SKILLS = {
    "pyspark": {
        "spark": 0.5,
    },

    "spark": {
        "pyspark": 0.7,
    },

    "postgresql": {
        "sql": 0.5,
    },

    "mysql": {
        "sql": 0.5,
    },

    "mongodb": {
        "sql": 0.25,
    },

    "machine learning": {
        "scikit-learn": 0.5,
        "tensorflow": 0.5,
        "pytorch": 0.5,
    },

    "scikit-learn": {
        "machine learning": 0.5,
    },

    "tensorflow": {
        "machine learning": 0.5,
    },

    "pytorch": {
        "machine learning": 0.5,
    },

    "power bi": {
        "tableau": 0.5,
    },

    "tableau": {
        "power bi": 0.5,
    },
}


# =========================================================
# TEXT NORMALIZATION
# =========================================================

def normalize_text(text):
    text = (text or "").lower()

    replacements = {
        "-": " ",
        "_": " ",
        "/": " ",
        "(": " ",
        ")": " ",
        ",": " ",
        ".": " ",
        ":": " ",
        ";": " ",
        "|": " ",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return " ".join(text.split())


# =========================================================
# SAFE SKILL SEARCH
# =========================================================

def contains_skill(text, skill_phrase):
    normalized_text = normalize_text(text)
    normalized_skill = normalize_text(skill_phrase)

    pattern = (
        r"(?<![a-z0-9])"
        + re.escape(normalized_skill)
        + r"(?![a-z0-9])"
    )

    return re.search(pattern, normalized_text) is not None


# =========================================================
# EXTRACT SKILLS
# =========================================================

def extract_skills(text):
    found_skills = []

    for skill, aliases in SKILL_ALIASES.items():

        for alias in aliases:

            if contains_skill(text, alias):
                found_skills.append(skill)
                break

    return found_skills


# =========================================================
# CALCULATE SKILL MATCH
# =========================================================

def calculate_skill_match(resume_skills, jd_skills):

    if not jd_skills:
        return {
            "percentage": 0,
            "matched_skills": [],
            "missing_skills": [],
            "related_matches": [],
        }

    total_weight = 0
    earned_weight = 0

    matched_skills = []
    missing_skills = []
    related_matches = []

    for jd_skill in jd_skills:

        weight = SKILL_WEIGHTS.get(
            jd_skill,
            1.0
        )

        total_weight += weight

        # Direct match
        if jd_skill in resume_skills:

            earned_weight += weight
            matched_skills.append(jd_skill)

            continue

        # Related skill match
        related_options = RELATED_SKILLS.get(
            jd_skill,
            {}
        )

        related_found = False

        for resume_skill, credit in related_options.items():

            if resume_skill in resume_skills:

                earned_weight += weight * credit

                matched_skills.append(jd_skill)

                related_matches.append({
                    "required_skill": jd_skill,
                    "resume_skill": resume_skill,
                    "credit": credit,
                })

                related_found = True
                break

        if not related_found:
            missing_skills.append(jd_skill)

    percentage = round(
        (earned_weight / total_weight) * 100,
        2
    ) if total_weight > 0 else 0

    return {
        "percentage": percentage,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "related_matches": related_matches,
    }


# =========================================================
# ATS SCORE
# =========================================================

def calculate_ats_score(
    resume_text,
    job_description,
    match_percentage,
    resume_skills,
    jd_skills
):
    """
    Project-level ATS-style score.

    Components:
    70% = Job keyword/skill match
    20% = Resume section completeness
    10% = Resume text quality
    """

    resume_lower = normalize_text(resume_text)

    # -------------------------
    # 1. Keyword / Skill Match
    # -------------------------

    keyword_score = float(match_percentage)

    # -------------------------
    # 2. Resume Sections
    # -------------------------

    section_keywords = {
        "summary": [
            "summary",
            "professional summary",
            "objective",
        ],

        "experience": [
            "experience",
            "work experience",
            "internship",
        ],

        "education": [
            "education",
            "academic",
        ],

        "skills": [
            "skills",
            "technical skills",
            "technologies",
        ],

        "projects": [
            "projects",
            "project",
        ],
    }

    sections_found = 0

    for aliases in section_keywords.values():

        if any(
            contains_skill(resume_text, alias)
            for alias in aliases
        ):
            sections_found += 1

    section_score = (
        sections_found / len(section_keywords)
    ) * 100

    # -------------------------
    # 3. Resume Text Quality
    # -------------------------

    word_count = len(resume_lower.split())

    if word_count >= 300:
        quality_score = 100
    elif word_count >= 200:
        quality_score = 85
    elif word_count >= 100:
        quality_score = 70
    elif word_count >= 50:
        quality_score = 50
    else:
        quality_score = 25

    # -------------------------
    # Final ATS Score
    # -------------------------

    ats_score = (
        keyword_score * 0.70
        + section_score * 0.20
        + quality_score * 0.10
    )

    return round(
        min(max(ats_score, 0), 100),
        2
    )


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message": "AI Resume Analyzer API is running!",
        "version": "4.0.0",
    }


# =========================================================
# UPLOAD RESUME
# =========================================================

@app.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...)
):

    if not file.filename.lower().endswith(".pdf"):
        return {
            "error": "Only PDF resumes are supported."
        }

    contents = await file.read()

    pdf = pymupdf.open(
        stream=contents,
        filetype="pdf"
    )

    text = ""

    for page in pdf:
        text += page.get_text()

    pdf.close()

    if not text.strip():
        return {
            "error": "Could not extract text from this PDF."
        }

    return {
        "filename": file.filename,
        "text": text,
    }


# =========================================================
# JOB DESCRIPTION
# =========================================================

class JobDescription(BaseModel):
    text: str


@app.post("/job-description")
def add_job_description(
    job: JobDescription
):

    return {
        "message": "Job description received successfully",
        "job_description": job.text,
    }


# =========================================================
# ANALYSIS REQUEST
# =========================================================

class ResumeMatchRequest(BaseModel):

    resume_text: str
    job_description: str
    resume_filename: str | None = None


# =========================================================
# ANALYZE RESUME
# =========================================================

@app.post("/analyze")
def analyze_resume(
    data: ResumeMatchRequest
):

    # -------------------------
    # Extract skills
    # -------------------------

    resume_skills = extract_skills(
        data.resume_text
    )

    jd_skills = extract_skills(
        data.job_description
    )

    # -------------------------
    # Calculate skill match
    # -------------------------

    match_result = calculate_skill_match(
        resume_skills,
        jd_skills
    )

    match_percentage = match_result["percentage"]

    matched_skills = match_result["matched_skills"]

    missing_skills = match_result["missing_skills"]

    related_matches = match_result["related_matches"]

    # -------------------------
    # ATS SCORE
    # -------------------------

    ats_score = calculate_ats_score(
        resume_text=data.resume_text,
        job_description=data.job_description,
        match_percentage=match_percentage,
        resume_skills=resume_skills,
        jd_skills=jd_skills,
    )

    # -------------------------
    # Gemini AI Analysis
    # -------------------------

    ai_result = analyze_with_ai(
        data.resume_text,
        data.job_description,
        missing_skills
    )

    # -------------------------
    # Save to MySQL
    # -------------------------

    db = SessionLocal()

    try:

        analysis = models.ResumeAnalysis(

            resume_filename=data.resume_filename,

            resume_text=data.resume_text,

            job_description=data.job_description,

            match_percentage=match_percentage,

            matched_skills=", ".join(
                matched_skills
            ),

            missing_skills=", ".join(
                missing_skills
            ),

            ai_analysis=ai_result,
        )

        db.add(analysis)

        db.commit()

        db.refresh(analysis)

        return {

            "id": analysis.id,

            "resume_filename":
                analysis.resume_filename,

            "resume_skills":
                resume_skills,

            "job_description_skills":
                jd_skills,

            "matched_skills":
                matched_skills,

            "missing_skills":
                missing_skills,

            "match_percentage":
                match_percentage,

            "ats_score":
                ats_score,

            "related_matches":
                related_matches,

            "ai_analysis":
                ai_result,

            "created_at":
                analysis.created_at,

            "message":
                "Analysis saved successfully",
        }

    finally:

        db.close()


# =========================================================
# ANALYSIS HISTORY
# =========================================================

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

                "resume_filename":
                    analysis.resume_filename,

                "job_description":
                    analysis.job_description,

                "match_percentage":
                    analysis.match_percentage,

                "matched_skills":
                    analysis.matched_skills,

                "missing_skills":
                    analysis.missing_skills,

                "ai_analysis":
                    analysis.ai_analysis,

                "created_at":
                    analysis.created_at,
            }

            for analysis in analyses

        ]

    finally:

        db.close()


# =========================================================
# VIEW SINGLE ANALYSIS
# =========================================================

@app.get("/history/{analysis_id}")
def get_single_analysis(
    analysis_id: int
):

    db = SessionLocal()

    try:

        analysis = (
            db.query(
                models.ResumeAnalysis
            )
            .filter(
                models.ResumeAnalysis.id
                == analysis_id
            )
            .first()
        )

        if not analysis:

            return {
                "message": "Analysis not found"
            }

        # Recalculate ATS score for old records
        resume_skills = extract_skills(
            analysis.resume_text
        )

        jd_skills = extract_skills(
            analysis.job_description
        )

        ats_score = calculate_ats_score(
            resume_text=analysis.resume_text,
            job_description=analysis.job_description,
            match_percentage=analysis.match_percentage or 0,
            resume_skills=resume_skills,
            jd_skills=jd_skills,
        )

        return {

            "id": analysis.id,

            "resume_filename":
                analysis.resume_filename,

            "resume_text":
                analysis.resume_text,

            "job_description":
                analysis.job_description,

            "match_percentage":
                analysis.match_percentage,

            "ats_score":
                ats_score,

            "matched_skills":
                analysis.matched_skills,

            "missing_skills":
                analysis.missing_skills,

            "ai_analysis":
                analysis.ai_analysis,

            "created_at":
                analysis.created_at,
        }

    finally:

        db.close()


# =========================================================
# DELETE HISTORY
# =========================================================

@app.delete("/history/{analysis_id}")
def delete_analysis(
    analysis_id: int
):

    db = SessionLocal()

    try:

        analysis = (
            db.query(
                models.ResumeAnalysis
            )
            .filter(
                models.ResumeAnalysis.id
                == analysis_id
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
            "message":
                "Analysis deleted successfully",

            "id":
                analysis_id,
        }

    finally:

        db.close()