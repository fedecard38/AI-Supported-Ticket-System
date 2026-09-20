from typing import Literal, Optional
from pydantic import BaseModel, Field


class TicketClassification(BaseModel):
    """
    Structured classification schema for AI ticket triaging.
    Categories and priorities match PostgreSQL database ENUM definitions.
    """
    category: Literal[
        "Finance",
        "Legal",
        "Operations",
        "IT Support",
        "Human Resources",
        "Customer Success",
    ] = Field(
        ...,
        description="Department category (Finance, Legal, Operations, IT Support, Human Resources, Customer Success)",
    )
    priority: Literal["High", "Medium", "Low"] = Field(
        ...,
        description="Ticket priority level (High, Medium, Low)",
    )
    summary: str = Field(
        ...,
        description="Concise 1-2 sentences summarizing the core issue or request",
    )

    def __await__(self):
        """Allows instances to be awaited seamlessly by async callers."""
        async def _identity():
            return self
        return _identity().__await__()


class TicketTriageRequest(BaseModel):
    """Payload for invoking ticket classification via API."""
    consumer_name: str = Field(..., min_length=1, description="Name of the consumer or user submitting the ticket")
    request_text: Optional[str] = Field(default=None, description="Combined content of the ticket issue or inquiry")
    title: Optional[str] = Field(default=None, description="Optional subject/title of the ticket")
    description: Optional[str] = Field(default=None, description="Detailed problem description")
    attachment_url: Optional[str] = Field(default=None, description="Optional attachment or document URL")
