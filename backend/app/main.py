import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Ticket Workspace API",
    description="Backend API for AI-Supported Ticket System",
    version="1.0.0",
)

# CORS configuration
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "AI Ticket Workspace Backend",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "database": {
            "configured": bool(os.getenv("DATABASE_URL")),
        },
        "maildev": {
            "host": os.getenv("SMTP_HOST", "maildev"),
            "port": int(os.getenv("SMTP_PORT", 1025)),
        },
    }
