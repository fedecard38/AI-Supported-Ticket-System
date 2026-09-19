from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.setup import router as setup_router
from app.core.setup import setup_manager
from app.middleware.setup_middleware import SetupMiddleware

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Requirement 1: When the container starts, check if '/app/config/setup_state.json' exists.
    active = setup_manager.check_setup_state()
    if active:
        logger.info(f"Container started: Setup state is ACTIVE ({setup_manager.config_file_path}).")
    else:
        logger.warning(
            f"Container started: System uninitialized. setup_state.json absent at {setup_manager.config_file_path}. "
            "Intercepting calls with HTTP 428 Precondition Required."
        )
    yield


app = FastAPI(
    title="AI Ticket Workspace API",
    description="Backend API for AI-Supported Ticket System",
    version="1.0.0",
    lifespan=lifespan,
)

# Intercept API calls and return HTTP 428 if uninitialized
app.add_middleware(SetupMiddleware)

# CORS configuration (placed outermost so OPTIONS and error responses include CORS headers)
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

# Register Setup router
app.include_router(setup_router)


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
