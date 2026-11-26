"""
Database configuration and session management for SQLite with SQLAlchemy.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Resolve SQLite database file path inside the backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE_PATH = os.path.join(BASE_DIR, "team_availability.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE_PATH}"

# Create SQLite engine with check_same_thread disabled for multi-threaded FastAPI workers
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# SessionLocal class for creating database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides an isolated SQLAlchemy session per request
    and guarantees that the session is closed upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
