# AI-Supported Ticket System

Dockerized AI Ticket Workspace featuring an AI-Supported Ticket Management system, interactive frontend dashboard, FastAPI backend, PostgreSQL 16 database, local MailDev SMTP testing, and an **Asynchronous Email Notification Service** powered by FastAPI `BackgroundTasks`.

---

## Architecture & Services

| Service | Technology | Internal Port | Host Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | `3000` | `3000` | Interactive user interface with hot-reloading |
| **Backend** | Python 3.11 + FastAPI | `8000` | `8000` | REST API with Uvicorn auto-reload and Swagger docs |
| **Database** | PostgreSQL 16 Alpine | `5432` | `5432` | Relational storage with persistent volume |
| **MailDev** | MailDev SMTP & Web | `1025` / `1080` | `1025` / `1080` | Test SMTP server & web inspector for outgoing emails |

---

## Asynchronous Notification Workflow

When a customer or user creates a ticket:
1. **Instant Ticket Confirmation**: The consumer receives an immediate `HTTP 201 Created` response with their ticket details.
2. **Non-Blocking Background Tasks**: FastAPI `BackgroundTasks` spawns an asynchronous worker thread that runs independently.
3. **Targeted Operator Routing**:
   - For a ticket created with category `C` (e.g. `Finance`, `IT Support`, `Legal`), the system queries all active users where `role='Responsible'` and `assigned_category=C`.
4. **HTML Email via SMTP**:
   - The worker constructs a responsive HTML email containing:
     - **Ticket ID**
     - **Consumer Name**
     - **Priority** (High, Medium, Low)
     - **AI Summary**
   - The message is transmitted via SMTP to MailDev (`localhost:1025` or `maildev:1025`).
   - Emails can be inspected immediately in real-time at [http://localhost:1080](http://localhost:1080).

---

## Quick Start

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed.

### 2. Environment Setup
Copy the sample environment variables:
```bash
cp .env.example .env
```

### 3. Launch Services
Run the entire stack with build:
```bash
docker compose up --build -d
```

To stop all services:
```bash
docker compose down
```

To reset volumes (wipes database data):
```bash
docker compose down -v
```

---

## Access Points

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **Backend API & Health Check:** [http://localhost:8000](http://localhost:8000)
- **FastAPI Interactive Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **MailDev Web Inspector:** [http://localhost:1080](http://localhost:1080)
- **MailDev SMTP Server:** `localhost:1025`
- **PostgreSQL Database:** `localhost:5432` (User: `postgres`, Password: `postgres`, DB: `ticket_system`)

---

## Testing & Quality Assurance

Run the comprehensive automated test suite (AI Triage, Data Models, Setup & Security, and Notifications):
```bash
pytest backend/tests -v
```
*(On Windows using virtualenv: `.\backend\.venv\Scripts\python.exe -m pytest backend/tests -v`)*
