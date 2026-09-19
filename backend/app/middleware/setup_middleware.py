import logging
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.setup import setup_manager

logger = logging.getLogger("setup_middleware")

# Paths that are allowed when the instance is uninitialized
EXEMPT_ROUTES = (
    "/api/setup",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
)


class SetupMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts all API calls when the system is uninitialized.
    Returns HTTP 428 Precondition Required {"setup_required": true} for non-exempt routes.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Pre-flight CORS OPTIONS requests must pass through to avoid breaking browser clients
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check if the setup is active
        if not setup_manager.is_active():
            path = request.url.path
            is_exempt = any(path == route or path.startswith(route + "/") for route in EXEMPT_ROUTES)

            if not is_exempt:
                logger.debug(f"Intercepted uninitialized request to {path}. Returning 428.")
                return JSONResponse(
                    status_code=428,
                    content={"setup_required": True},
                )

        return await call_next(request)
