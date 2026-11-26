"""
SQLAlchemy ORM models for Team Availability Tracker.
"""

from sqlalchemy import Boolean, Column, String
from database import Base


class User(Base):
    """
    SQLAlchemy User model representing team members and their availability status.
    Stored in the 'users' table in SQLite.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    department = Column(String, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)

    def to_dict(self):
        """Helper to serialize model instance to standard dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "is_available": self.is_available
        }

    def __repr__(self):
        return f"<User(id='{self.id}', name='{self.name}', is_available={self.is_available})>"
