from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CommentAuthorRole


class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, description="Comment body content")
    author_role: Union[CommentAuthorRole, str] = Field(
        ...,
        description="Role of the comment author (Owner, Responsible, Customer, AI Assistant)",
        examples=["Responsible"],
    )
    is_internal: bool = Field(default=False, description="Internal operator note hidden from customers")


class CommentCreate(CommentBase):
    ticket_id: Optional[int] = Field(default=None, description="Target ticket ID (optional if set in path)")
    author_id: Optional[int] = Field(default=None, description="Optional ID of user author")


class CommentRead(CommentBase):
    id: int
    ticket_id: int
    author_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
