from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):

    DATABASE_URL: str = "sqlite:///./resumes.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = DatabaseSettings()

db_url = settings.DATABASE_URL

# Fix legacy postgres:// URL scheme from some cloud providers
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine_kwargs = {"echo": True}

if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    db_url,
    **engine_kwargs
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


Base = declarative_base()