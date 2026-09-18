# AI-Supported Ticket System

Dockerized AI Ticket Workspace featuring an AI-Supported Ticket Management system, interactive frontend dashboard, FastAPI backend, PostgreSQL 16 database, and local MailDev SMTP testing.

---

## Architecture & Services

| Service | Technology | Internal Port | Host Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | `3000` | `3000` | Interactive user interface with hot-reloading |
| **Backend** | Python 3.11 + FastAPI | `8000` | `8000` | REST API with Uvicorn auto-reload and Swagger docs |
| **Database** | PostgreSQL 16 Alpine | `5432` | `5432` | Relational storage with persistent volume |
| **MailDev** | MailDev SMTP & Web | `1025` / `1080` | `1025` / `1080` | Test SMTP server & web inspector for outgoing emails |

---

## Quick Start

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed.

### 2. Environment Setup
A default `.env` file is included. You can customize variables or duplicate `.env.example`:
```bash
cp .env.example .env
```

### 3. Launch Services
Run the entire stack with build:
```bash
docker compose up --build
```

To run in detached (background) mode:
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

## Development & Hot Reloading

- **Backend Hot-Reload:** Edits inside the `backend/` directory immediately trigger Uvicorn reloads inside the container.
- **Frontend Hot-Reload:** Vite is configured with polling enabled (`usePolling: true`) to ensure file change events trigger fast HMR across cross-platform host volume mounts.
