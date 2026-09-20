from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.setup import hash_password, setup_manager, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserLoginRequest, UserLoginResponse, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("/login", response_model=UserLoginResponse, summary="User & Owner Login")
def login(login_in: UserLoginRequest, db: Session = Depends(get_db)) -> UserLoginResponse:
    # 1. Check if matches setup owner credentials
    if setup_manager._state_data:
        owner_email = setup_manager._state_data.get("owner_email")
        owner_hash = setup_manager._state_data.get("owner_password_hash")
        if owner_email and login_in.email.lower() == owner_email.lower():
            if owner_hash and verify_password(login_in.password, owner_hash):
                return UserLoginResponse(
                    id=0,
                    email=owner_email,
                    full_name="System Owner",
                    role="Owner",
                    assigned_category="All",
                    message="Owner authentication successful",
                )

    # 2. Check in database users table
    stmt = select(User).where(User.email == login_in.email)
    user = db.scalars(stmt).first()
    if user and verify_password(login_in.password, user.password_hash):
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive. Contact system administrator.",
            )
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        return UserLoginResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=role_str,
            assigned_category=user.assigned_category,
            message=f"{role_str} authentication successful",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )



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


@router.patch("/{user_id}", response_model=UserRead, summary="Update User")
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
) -> UserRead:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.password_hash = hash_password(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK, summary="Delete User")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    db.delete(user)
    db.commit()
    return {"message": f"User #{user_id} successfully deleted."}
