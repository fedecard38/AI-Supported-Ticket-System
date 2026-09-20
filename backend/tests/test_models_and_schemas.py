from datetime import datetime
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.comment import Comment
from app.models.enums import (
    CommentAuthorRole,
    TicketCategory,
    TicketPriority,
    TicketStatus,
    UserRole,
)
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentRead
from app.schemas.ticket import TicketCreate, TicketDetailRead, TicketRead
from app.schemas.user import UserCreate, UserRead


@pytest.fixture
def db_session():
    """In-memory SQLite database session for unit testing models and relations."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


def test_enums_completeness():
    """Verify all required ENUM values are accurately defined."""
    # Category ENUM requirements: Finance, Legal, Operations, IT Support, Human Resources, Customer Success
    expected_categories = {
        "Finance",
        "Legal",
        "Operations",
        "IT Support",
        "Human Resources",
        "Customer Success",
    }
    actual_categories = {c.value for c in TicketCategory}
    assert actual_categories == expected_categories

    # Priority ENUM requirements: High, Medium, Low
    expected_priorities = {"High", "Medium", "Low"}
    actual_priorities = {p.value for p in TicketPriority}
    assert actual_priorities == expected_priorities

    # User role requirements: Owner, Responsible
    expected_roles = {"Owner", "Responsible"}
    actual_roles = {r.value for r in UserRole}
    assert actual_roles == expected_roles


def test_database_indexes_on_status_and_category(db_session):
    """Verify indexes exist on status and category columns as required."""
    inspector = inspect(db_session.bind)
    indexes = inspector.get_indexes("tickets")
    indexed_columns = {col for idx in indexes for col in idx["column_names"]}

    assert "category" in indexed_columns
    assert "status" in indexed_columns


def test_user_creation_with_role_and_assigned_category(db_session):
    """Verify User model stores role and assigned_category string."""
    user = User(
        email="operator@ticketworkspace.com",
        full_name="Lead Engineer",
        password_hash="hashed_pw_123",
        role=UserRole.RESPONSIBLE,
        assigned_category="IT Support",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.id is not None
    assert user.role == UserRole.RESPONSIBLE
    assert user.assigned_category == "IT Support"
    assert isinstance(user.created_at, datetime)
    assert isinstance(user.updated_at, datetime)


def test_ticket_creation_and_relations(db_session):
    """Verify Ticket model with category, priority, status, and creator/assignee foreign keys."""
    owner = User(
        email="owner@ticketworkspace.com",
        full_name="System Owner",
        password_hash="hash_owner",
        role=UserRole.OWNER,
    )
    responsible = User(
        email="finance_lead@ticketworkspace.com",
        full_name="Finance Officer",
        password_hash="hash_resp",
        role=UserRole.RESPONSIBLE,
        assigned_category="Finance",
    )
    db_session.add_all([owner, responsible])
    db_session.commit()

    ticket = Ticket(
        title="Q3 Budget Reconciliation Discrepancy",
        description="Discrepancy found in ledger invoice account balance.",
        category=TicketCategory.FINANCE,
        priority=TicketPriority.HIGH,
        status=TicketStatus.OPEN,
        creator_id=owner.id,
        assignee_id=responsible.id,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    assert ticket.id is not None
    assert ticket.category == TicketCategory.FINANCE
    assert ticket.priority == TicketPriority.HIGH
    assert ticket.status == TicketStatus.OPEN
    assert ticket.creator.email == "owner@ticketworkspace.com"
    assert ticket.assignee.email == "finance_lead@ticketworkspace.com"
    assert isinstance(ticket.created_at, datetime)
    assert isinstance(ticket.updated_at, datetime)


def test_comment_linked_to_ticket_with_author_role(db_session):
    """Verify Comment model linked to Ticket with author_role field."""
    author = User(
        email="ops_manager@ticketworkspace.com",
        password_hash="hash_ops",
        role=UserRole.RESPONSIBLE,
        assigned_category="Operations",
    )
    db_session.add(author)
    db_session.commit()

    ticket = Ticket(
        title="Server Cluster Cooling Failure",
        description="Datacenter rack 4 temperature alarm triggered.",
        category=TicketCategory.OPERATIONS,
        priority=TicketPriority.HIGH,
        status=TicketStatus.IN_PROGRESS,
        creator_id=author.id,
    )
    db_session.add(ticket)
    db_session.commit()

    # Create comment with author_role
    comment = Comment(
        ticket_id=ticket.id,
        author_id=author.id,
        author_role=CommentAuthorRole.RESPONSIBLE.value,
        content="Facility technicians have been dispatched to inspect chiller units.",
        is_internal=True,
    )
    db_session.add(comment)
    db_session.commit()
    db_session.refresh(ticket)

    assert len(ticket.comments) == 1
    retrieved_comment = ticket.comments[0]
    assert retrieved_comment.author_role == "Responsible"
    assert retrieved_comment.content.startswith("Facility technicians")
    assert retrieved_comment.ticket.title == "Server Cluster Cooling Failure"
    assert isinstance(retrieved_comment.created_at, datetime)


def test_pydantic_schema_validation_and_serialization(db_session):
    """Verify Pydantic schemas accurately validate ENUM inputs and serialize ORM objects."""
    # 1. Valid TicketCreate
    valid_data = {
        "title": "Onboarding Portal Login Issue",
        "description": "New hires cannot complete SSO login on day 1.",
        "category": "Human Resources",
        "priority": "High",
        "status": "Open",
    }
    schema = TicketCreate(**valid_data)
    assert schema.category == TicketCategory.HUMAN_RESOURCES
    assert schema.priority == TicketPriority.HIGH

    # 2. Invalid Category rejected by Pydantic
    invalid_data = valid_data.copy()
    invalid_data["category"] = "InvalidDepartment"
    with pytest.raises(ValidationError):
        TicketCreate(**invalid_data)

    # 3. Invalid Priority rejected by Pydantic
    invalid_priority = valid_data.copy()
    invalid_priority["priority"] = "CriticalSuperHigh"
    with pytest.raises(ValidationError):
        TicketCreate(**invalid_priority)

    # 4. ORM to Pydantic from_attributes serialization
    user = User(
        email="support@ticketworkspace.com",
        password_hash="hash_123",
        role=UserRole.RESPONSIBLE,
        assigned_category="Customer Success",
    )
    db_session.add(user)
    db_session.commit()

    ticket = Ticket(
        title="Subscription cancellation inquiry",
        description="Client requests downgrade to basic plan.",
        category=TicketCategory.CUSTOMER_SUCCESS,
        priority=TicketPriority.LOW,
        assignee_id=user.id,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    ticket_read = TicketRead.model_validate(ticket)
    assert ticket_read.id == ticket.id
    assert ticket_read.category == TicketCategory.CUSTOMER_SUCCESS
    assert ticket_read.priority == TicketPriority.LOW
    assert ticket_read.status == TicketStatus.OPEN
    assert ticket_read.created_at == ticket.created_at


def test_ticket_update_and_user_update_schemas():
    """Verify TicketUpdate and UserUpdate schema serialization."""
    from app.schemas.ticket import TicketUpdate
    from app.schemas.user import UserUpdate

    # Test TicketUpdate with partial fields
    t_update = TicketUpdate(status=TicketStatus.IN_PROGRESS, priority=TicketPriority.HIGH)
    dumped = t_update.model_dump(exclude_unset=True)
    assert dumped == {"status": TicketStatus.IN_PROGRESS, "priority": TicketPriority.HIGH}

    # Test UserUpdate
    u_update = UserUpdate(assigned_category="Finance", is_active=True)
    u_dumped = u_update.model_dump(exclude_unset=True)
    assert u_dumped == {"assigned_category": "Finance", "is_active": True}

