from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.schemas.comment import CommentRead
from app.schemas.user import UserRead


class TicketBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Brief summary of ticket issue")
    description: str = Field(..., min_length=1, description="Detailed ticket description")
    category: Optional[TicketCategory] = Field(
        default=None,
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
    consumer_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Name of the consumer or user submitting the ticket",
    )
    consumer_email: Optional[EmailStr] = Field(
        default=None,
        description="Optional email address of the consumer to receive ticket updates and comments",
    )
    ai_summary: Optional[str] = Field(
        default=None,
        description="AI-generated summary of the ticket issue",
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
    consumer_name: Optional[str] = Field(default=None, max_length=255)
    consumer_email: Optional[EmailStr] = None
    ai_classification: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_summary: Optional[str] = None


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
