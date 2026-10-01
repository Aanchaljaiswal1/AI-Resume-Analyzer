from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pydantic_settings import BaseSettings


class DatabaseSettings(BaseSettings):

    DATABASE_URL: str

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = DatabaseSettings()


engine = create_engine(
    settings.DATABASE_URL,
    echo=True
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


Base = declarative_base()