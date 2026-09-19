from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="Unique email address for user account")
    full_name: Optional[str] = Field(default=None, max_length=255, description="Full name of the user")
    role: UserRole = Field(default=UserRole.RESPONSIBLE, description="User permission role (Owner or Responsible)")
    assigned_category: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Assigned functional department / category",
    )
    is_active: bool = Field(default=True, description="Account active status")


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="User password (min 8 characters)")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    role: Optional[UserRole] = None
    assigned_category: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserRead(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
