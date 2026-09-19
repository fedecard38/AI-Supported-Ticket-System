from app.api.setup import router as setup_router
from app.api.tickets import router as tickets_router
from app.api.users import router as users_router

__all__ = ["setup_router", "users_router", "tickets_router"]
