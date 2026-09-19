from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.setup import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Create User / Responsible")
def create_user(user_in: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    # Check if email already exists
    existing = db.scalars(select(User).where(User.email == user_in.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{user_in.email}' already exists.",
        )

    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        assigned_category=user_in.assigned_category,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("", response_model=List[UserRead], summary="List All Users")
def list_users(db: Session = Depends(get_db)) -> List[UserRead]:
    stmt = select(User).order_by(User.id.asc())
    users = db.scalars(stmt).all()
    return users


@router.get("/{user_id}", response_model=UserRead, summary="Get User by ID")
def get_user(user_id: int, db: Session = Depends(get_db)) -> UserRead:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return user
