from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.schemas.comment import CommentRead
from app.schemas.user import UserRead


class TicketBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Brief summary of ticket issue")
    description: str = Field(..., min_length=1, description="Detailed ticket description")
    category: TicketCategory = Field(
        ...,
        description="Department category (Finance, Legal, Operations, IT Support, Human Resources, Customer Success)",
    )
    priority: TicketPriority = Field(
        default=TicketPriority.MEDIUM,
        description="Priority level (High, Medium, Low)",
    )
    status: TicketStatus = Field(
        default=TicketStatus.OPEN,
        description="Ticket progress status (Open, In Progress, Resolved, Closed)",
    )


class TicketCreate(TicketBase):
    assignee_id: Optional[int] = Field(default=None, description="Assigned operator user ID")


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, min_length=1)
    category: Optional[TicketCategory] = None
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assignee_id: Optional[int] = None
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None


class TicketRead(TicketBase):
    id: int
    creator_id: Optional[int] = None
    assignee_id: Optional[int] = None
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketDetailRead(TicketRead):
    creator: Optional[UserRead] = None
    assignee: Optional[UserRead] = None
    comments: List[CommentRead] = []

    model_config = ConfigDict(from_attributes=True)
