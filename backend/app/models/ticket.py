from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Enum as SAEnum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import TicketCategory, TicketPriority, TicketStatus

if TYPE_CHECKING:
    from app.models.comment import Comment
    from app.models.user import User


class Ticket(Base, TimestampMixin):
    """
    Ticket entity representing customer/internal issues.
    Features indexed category and status, priority, and foreign key relations.
    """
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Category ENUM with database index
    category: Mapped[TicketCategory] = mapped_column(
        SAEnum(TicketCategory, name="ticket_category_enum", native_enum=False, values_callable=lambda x: [e.value for e in x]),
        index=True,
        nullable=False,
    )

    # Priority ENUM
    priority: Mapped[TicketPriority] = mapped_column(
        SAEnum(TicketPriority, name="ticket_priority_enum", native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )

    # Status ENUM with database index
    status: Mapped[TicketStatus] = mapped_column(
        SAEnum(TicketStatus, name="ticket_status_enum", native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=TicketStatus.OPEN,
        index=True,
        nullable=False,
    )

    # Foreign Keys
    creator_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignee_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Requester / Consumer Info
    consumer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    consumer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # AI Enhancement fields
    ai_classification: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Table Indexes (explicit composite index for high-performance dashboard filtering)
    __table_args__ = (
        Index("ix_tickets_category_status", "category", "status"),
    )

    # Relationships
    creator: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[creator_id],
        back_populates="created_tickets",
    )
    assignee: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assignee_id],
        back_populates="assigned_tickets",
    )
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="Comment.created_at.asc()",
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, title='{self.title}', category='{self.category}', priority='{self.priority}', status='{self.status}')>"
