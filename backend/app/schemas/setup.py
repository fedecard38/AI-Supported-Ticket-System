import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class DatabaseSettings(BaseModel):
    host: str = Field(..., description="Database host address", examples=["postgres"])
    port: int = Field(default=5432, description="Database port", ge=1, le=65535)
    db_name: str = Field(..., min_length=1, description="Database name", examples=["ticket_system"])
    user: str = Field(..., min_length=1, description="Database username", examples=["postgres"])
    password: str = Field(..., min_length=1, description="Database password")
    ssl_mode: Optional[str] = Field(default="prefer", description="SSL mode")
    connection_string: Optional[str] = Field(default=None, description="Optional raw connection string")

    def get_connection_url(self) -> str:
        if self.connection_string:
            return self.connection_string
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.db_name}"


class InitializeRequest(BaseModel):
    owner_email: EmailStr = Field(..., description="System owner email address")
    owner_password: str = Field(
        ...,
        min_length=8,
        description="Owner master password (min 8 chars, mixed case, number, and special character)",
    )
    gemini_api_key: str = Field(
        ...,
        min_length=10,
        description="Google Gemini API key",
    )
    db_settings: DatabaseSettings
    validate_external: bool = Field(
        default=True,
        description="Whether to perform active network verification for Gemini API and DB connection",
    )

    @field_validator("owner_password")
    @classmethod
    def validate_strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=~`[\]\\/]", v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("gemini_api_key")
    @classmethod
    def validate_gemini_key_format(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Gemini API key cannot be empty")
        if len(stripped) < 20:
            raise ValueError("Gemini API key appears too short (must be at least 20 characters)")
        return stripped


class FactoryResetRequest(BaseModel):
    owner_password: str = Field(..., min_length=1, description="Owner master password to authorize reset")
    wipe_database: bool = Field(default=False, description="Wipe database tables during reset")


class SetupStatusResponse(BaseModel):
    setup_required: bool
    status: str
    owner_email: Optional[str] = None
    initialized_at: Optional[str] = None


class InitializeResponse(BaseModel):
    message: str
    status: str
    owner_email: str
    setup_required: bool = False
