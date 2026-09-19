from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Enum as SAEnum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.comment import Comment
    from app.models.ticket import Ticket


class User(Base, TimestampMixin):
    """
    User entity representing system operators (Owner or Responsible).
    Can have an assigned_category for routing category-specific tickets.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum", native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=UserRole.RESPONSIBLE,
        nullable=False,
    )
    assigned_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    assigned_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="Ticket.assignee_id",
        back_populates="assignee",
    )
    created_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="Ticket.creator_id",
        back_populates="creator",
    )
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        foreign_keys="Comment.author_id",
        back_populates="author",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', category='{self.assigned_category}')>"
