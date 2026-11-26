# Team Availability Tracker

A modern, responsive full-stack SaaS dashboard for engineering teams to monitor real-time presence, manage availability status, and track team capacity at a glance.

---

## 🛠️ Technology Stack

- **Frontend:**
  - **HTML5:** Semantic, accessible layout structure.
  - **CSS3:** Custom properties (design tokens), light theme with purple/indigo accents, smooth animations, and responsive media queries (Desktop, Tablet, Mobile).
  - **Vanilla JavaScript (ES6+):** Zero-framework DOM manipulation, asynchronous Fetch API integration, optimistic UI updates with automatic failure rollback, and real-time metric calculation.
- **Backend:**
  - **Python 3:** High-performance asynchronous backend.
  - **FastAPI:** Modern REST API framework with automatic validation and interactive Swagger documentation.
  - **Pydantic (v2):** Strict request and response data modeling and payload validation.
  - **Uvicorn:** ASGI web server.
- **Database:**
  - **SQLite:** Lightweight, embedded ACID-compliant relational storage (`team_availability.db`).
  - **SQLAlchemy (v2) ORM:** Declarative data models, session management, and transaction control.

---

## 📁 Project Architecture & File Organization

```
Team-Availability-Tracker/
├── .gitignore                    # Excludes SQLite databases, venvs, and caches
├── README.md                     # Project documentation and run guide
├── backend/
│   ├── database.py               # SQLite engine, SessionLocal, Base, and get_db session dependency
│   ├── main.py                   # FastAPI application, CORS middleware, routes, and error handling
│   ├── models.py                 # SQLAlchemy User ORM model
│   ├── requirements.txt          # Python dependencies (fastapi, uvicorn, pydantic, sqlalchemy)
│   └── team_availability.db      # SQLite database file storing persistent team records
└── frontend/
    ├── index.html                # Main SaaS dashboard markup and modal states
    ├── script.js                 # API communication, toggle logic, search, filter, and metrics
    └── style.css                 # Modern CSS design system, responsive drawer, and UI polish
```

---

## 🚀 Key Features

1. **Persistent Real-Time Availability Toggles:**
   - Flip any team member between **Available** (green indicator) and **Unavailable** (grey indicator).
   - Asynchronous `PATCH /api/users/{user_id}/availability` updates the record directly in SQLite.
   - Values persist across browser reloads and server restarts.
2. **Dynamic Dashboard Metrics:**
   - Real-time summary cards: **Total Team Members**, **Available Members**, and **Unavailable Members**.
   - Dynamically calculated from backend data with live percentage capacity badges.
3. **Optimistic Locking & Error Rollback:**
   - Disables toggles during in-flight network requests to prevent duplicate submissions.
   - If an API request fails, the switch automatically rolls back to its previous state with a descriptive error notification.
4. **Live Search & Status Filtering:**
   - Search by team member name, job role, or corporate email address.
   - Filter tabs for **All**, **Available**, and **Unavailable** with real-time dynamic count indicators.
   - Friendly empty state with a 1-click filter reset action when no records match.
5. **Database Reset with Safety Confirmation:**
   - Dedicated "Reset to Defaults" action backed by `POST /api/reset` with confirmation prompts.
6. **Responsive SaaS Design:**
   - Designed for desktop, tablet, and mobile screens with collapsible navigation drawer.

---

## 📋 REST API Reference

Interactive API documentation (Swagger UI) is available at: `http://127.0.0.1:8000/docs`

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Application welcome information and documentation link | `200 OK` |
| `GET` | `/health` | Service readiness and live SQLite connectivity verification | `200 OK` / `503 Service Unavailable` |
| `GET` | `/api/users` | Retrieve all team members from SQLite | `200 OK` |
| `GET` | `/api/users/{user_id}` | Retrieve details of a specific team member | `200 OK` / `404 Not Found` |
| `PATCH` | `/api/users/{user_id}/availability` | Update member availability (`is_available`: boolean) in SQLite | `200 OK` / `404 Not Found` / `422 Unprocessable` |
| `POST` | `/api/reset` | Reset all team members back to default availability states in SQLite | `200 OK` |

---

## 💻 Installation & Quick Start

### 1. Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Backend Setup
Navigate to the project root and install dependencies:
```bash
pip install -r backend/requirements.txt
```

Start the FastAPI application with Uvicorn:
```bash
uvicorn main:app --app-dir backend --port 8000 --reload
```
The API server will run at: `http://127.0.0.1:8000`  
Swagger documentation: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
You can open `frontend/index.html` directly in your browser or serve it via any static file server:
```bash
# Using Python's built-in HTTP server:
python -m http.server 5500 --directory frontend
```
Then visit: `http://127.0.0.1:5500`

---

## 🧪 Testing

Execute test verification to validate endpoints, database persistence, and rollback handling:
```bash
python test_integration.py
```
