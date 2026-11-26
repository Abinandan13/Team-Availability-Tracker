"""
Team Availability Tracker - Backend API
Built with Python, FastAPI, SQLAlchemy ORM, and SQLite.
Module 3: SQLite Database Integration.
"""

from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

# Import database configuration and SQLAlchemy models
import models
from database import engine, SessionLocal, Base, get_db

# -----------------------------------------------------------------------------
# 1. Initial 10 Sample Team Members Specification
# -----------------------------------------------------------------------------
INITIAL_TEAM_MEMBERS = [
    {
        "id": "tm-1",
        "name": "Sarah Jenkins",
        "email": "sarah.jenkins@company.com",
        "role": "Senior Frontend Engineer",
        "department": "Engineering",
        "is_available": True
    },
    {
        "id": "tm-2",
        "name": "David Chen",
        "email": "david.chen@company.com",
        "role": "Lead Backend Architect",
        "department": "Core Infrastructure",
        "is_available": True
    },
    {
        "id": "tm-3",
        "name": "Elena Rostova",
        "email": "elena.rostova@company.com",
        "role": "Principal UI/UX Designer",
        "department": "Product Design",
        "is_available": True
    },
    {
        "id": "tm-4",
        "name": "Marcus Vance",
        "email": "marcus.vance@company.com",
        "role": "DevOps & Cloud Engineer",
        "department": "Infrastructure",
        "is_available": False
    },
    {
        "id": "tm-5",
        "name": "Priya Patel",
        "email": "priya.patel@company.com",
        "role": "Full Stack Developer",
        "department": "Engineering",
        "is_available": True
    },
    {
        "id": "tm-6",
        "name": "James Wilson",
        "email": "james.wilson@company.com",
        "role": "QA Automation Engineer",
        "department": "Quality Assurance",
        "is_available": False
    },
    {
        "id": "tm-7",
        "name": "Aisha Morales",
        "email": "aisha.morales@company.com",
        "role": "Engineering Manager",
        "department": "Management",
        "is_available": True
    },
    {
        "id": "tm-8",
        "name": "Lucas Meyer",
        "email": "lucas.meyer@company.com",
        "role": "Data & ML Specialist",
        "department": "Data Platform",
        "is_available": False
    },
    {
        "id": "tm-9",
        "name": "Hannah Abbott",
        "email": "hannah.abbott@company.com",
        "role": "Systems Security Analyst",
        "department": "InfoSec",
        "is_available": True
    },
    {
        "id": "tm-10",
        "name": "Kevin Brooks",
        "email": "kevin.brooks@company.com",
        "role": "Technical Product Specialist",
        "department": "Customer Solutions",
        "is_available": True
    }
]


def seed_initial_data(db: Session):
    """
    Seeds initial 10 team members into SQLite if they do not already exist.
    Prevents duplicates on application restarts and preserves existing availability updates.
    """
    for member_info in INITIAL_TEAM_MEMBERS:
        existing_user = db.query(models.User).filter(models.User.id == member_info["id"]).first()
        if not existing_user:
            user = models.User(
                id=member_info["id"],
                name=member_info["name"],
                email=member_info["email"],
                role=member_info["role"],
                department=member_info["department"],
                is_available=member_info["is_available"]
            )
            db.add(user)
    db.commit()


# Create tables and seed initial dataset immediately upon module import
Base.metadata.create_all(bind=engine)
_init_db = SessionLocal()
try:
    seed_initial_data(_init_db)
finally:
    _init_db.close()


# -----------------------------------------------------------------------------
# 2. Application Lifespan
# -----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema and initial data are present on startup
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


# -----------------------------------------------------------------------------
# 3. FastAPI Application Initialization & Metadata
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Team Availability Tracker API",
    description="REST API with SQLite & SQLAlchemy ORM for monitoring team availability.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# -----------------------------------------------------------------------------
# 4. CORS Middleware Configuration
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 5. Pydantic Schemas / Models
# -----------------------------------------------------------------------------
class UserBase(BaseModel):
    id: str = Field(..., description="Unique identifier for the team member")
    name: str = Field(..., description="Full employee name")
    email: str = Field(..., description="Corporate email address")
    role: str = Field(..., description="Job title / role")
    department: str = Field(..., description="Department or functional squad")
    is_available: bool = Field(..., description="Current availability state (True = Available, False = Unavailable)")


class UserResponse(UserBase):
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "tm-1",
                "name": "Sarah Jenkins",
                "email": "sarah.jenkins@company.com",
                "role": "Senior Frontend Engineer",
                "department": "Engineering",
                "is_available": True
            }
        }


class AvailabilityUpdateRequest(BaseModel):
    is_available: bool = Field(..., description="New availability status: true for Available, false for Unavailable")

    class Config:
        json_schema_extra = {
            "example": {
                "is_available": False
            }
        }


class RootResponse(BaseModel):
    message: str
    app: str
    version: str
    docs_url: str


class HealthResponse(BaseModel):
    status: str
    database: str
    service: str


# -----------------------------------------------------------------------------
# 6. Database Helper Functions
# -----------------------------------------------------------------------------
def get_user_from_db(db: Session, user_id: str) -> Optional[models.User]:
    """
    Find user by direct ID (e.g. 'tm-1') or alias without 'tm-' prefix (e.g. '1').
    """
    cleaned_id = str(user_id).strip().lower()

    # 1. Exact match
    user = db.query(models.User).filter(models.User.id == cleaned_id).first()
    if user:
        return user

    # 2. Case-insensitive exact match
    user = db.query(models.User).filter(models.User.id.ilike(cleaned_id)).first()
    if user:
        return user

    # 3. Handle prefix alias (e.g. '1' -> 'tm-1')
    if not cleaned_id.startswith("tm-"):
        prefixed_id = f"tm-{cleaned_id}"
        user = db.query(models.User).filter(models.User.id.ilike(prefixed_id)).first()
        if user:
            return user

    return None


# -----------------------------------------------------------------------------
# 7. REST API Endpoints (SQLite Powered)
# -----------------------------------------------------------------------------

@app.get(
    "/",
    response_model=RootResponse,
    summary="Root Welcome Endpoint",
    tags=["General"]
)
def get_root():
    """
    Welcome endpoint returning application information and API documentation links.
    """
    return {
        "message": "Welcome to the Team Availability Tracker API",
        "app": "Team Availability Tracker",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Backend & Database Health Check",
    tags=["General"]
)
def get_health(db: Session = Depends(get_db)):
    """
    Check backend operational status and verify live SQLite database connectivity.
    """
    try:
        # Perform query to test database connectivity
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connectivity failed: {str(exc)}"
        )

    return {
        "status": "healthy",
        "database": db_status,
        "service": "team-availability-tracker-api"
    }


@app.get(
    "/api/users",
    response_model=List[UserResponse],
    summary="Retrieve All Team Members from SQLite",
    tags=["Team Members"]
)
def get_all_users(db: Session = Depends(get_db)):
    """
    Fetch all 10 team members from the SQLite database.
    """
    users = db.query(models.User).all()
    return users


@app.get(
    "/api/users/{user_id}",
    response_model=UserResponse,
    summary="Retrieve Specific Team Member from SQLite",
    tags=["Team Members"]
)
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    """
    Fetch details for a specific team member from SQLite by ID.
    Returns HTTP 404 if the user does not exist.
    """
    user = get_user_from_db(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member with ID '{user_id}' was not found in the database"
        )
    return user


@app.patch(
    "/api/users/{user_id}/availability",
    response_model=UserResponse,
    summary="Update Team Member Availability in SQLite",
    tags=["Team Members"]
)
def update_user_availability(
    user_id: str,
    payload: AvailabilityUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update a team member's availability status in the SQLite database.
    Commits the transaction and returns the updated record.
    Returns HTTP 404 if the user does not exist.
    """
    user = get_user_from_db(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member with ID '{user_id}' was not found in the database"
        )

    try:
        user.is_available = payload.is_available
        db.commit()
        db.refresh(user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user availability in database: {str(exc)}"
        )

    return user


@app.post(
    "/api/reset",
    response_model=List[UserResponse],
    summary="Reset All Team Members to Default Availability",
    tags=["Team Members"]
)
def reset_all_users_to_default(db: Session = Depends(get_db)):
    """
    Resets all 10 team members in SQLite back to their original default availability values.
    Used by the frontend reset confirmation action.
    """
    try:
        initial_map = {m["id"]: m["is_available"] for m in INITIAL_TEAM_MEMBERS}
        users = db.query(models.User).all()
        for user in users:
            if user.id in initial_map:
                user.is_available = initial_map[user.id]
        db.commit()
        return db.query(models.User).all()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset team members in database: {str(exc)}"
        )


# -----------------------------------------------------------------------------
# 8. Local Server Execution Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
