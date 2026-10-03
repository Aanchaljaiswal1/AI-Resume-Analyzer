from sqlalchemy import Column, Integer, Text, Float, DateTime
from database import Base
from datetime import datetime


class ResumeAnalysis(Base):

    __tablename__ = "resume_analysis"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    resume_filename = Column(
        Text,
        nullable=True
    )

    resume_text = Column(
        Text,
        nullable=False
    )

    job_description = Column(
        Text,
        nullable=False
    )

    match_percentage = Column(
        Float
    )

    matched_skills = Column(
        Text
    )

    missing_skills = Column(
        Text
    )

    ai_analysis = Column(
        Text
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )