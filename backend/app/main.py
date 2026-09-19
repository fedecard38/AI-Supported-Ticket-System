from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.setup import router as setup_router
from app.api.tickets import router as tickets_router
from app.api.users import router as users_router
from app.core.database import init_db
from app.core.setup import get_gemini_api_key, setup_manager
from app.middleware.setup_middleware import SetupMiddleware

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Requirement 1: When the container starts, check if '/app/config/setup_state.json' exists.
    active = setup_manager.check_setup_state()
    if active:
        logger.info(f"Container started: Setup state is ACTIVE ({setup_manager.config_file_path}).")
        try:
            init_db()
        except Exception as exc:
            logger.warning(f"Database table initialization deferred: {exc}")
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

# Register API routers
app.include_router(setup_router)
app.include_router(users_router)
app.include_router(tickets_router)


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
    gemini_key = get_gemini_api_key()
    return {
        "status": "ok",
        "setup_required": not setup_manager.is_active(),
        "database": {
            "configured": bool(os.getenv("DATABASE_URL")),
        },
        "maildev": {
            "host": os.getenv("SMTP_HOST", "maildev"),
            "port": int(os.getenv("SMTP_PORT", 1025)),
        },
        "ai": {
            "configured": bool(gemini_key),
            "model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        },
    }
