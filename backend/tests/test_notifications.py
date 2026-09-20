import os
import smtplib
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.setup import setup_manager
from app.main import app
from app.models.enums import TicketCategory, TicketPriority, TicketStatus, UserRole
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketCreate
from app.services.notification import (
    build_ticket_notification_html,
    build_ticket_notification_text,
    get_responsible_users_for_category,
    send_email,
    send_ticket_creation_notification,
)


@pytest.fixture
def db_session():
    """In-memory SQLite database session for unit testing."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def active_setup(tmp_path, monkeypatch):
    """Ensure setup_manager is ACTIVE for API tests."""
    test_config_path = tmp_path / "config" / "setup_state.json"
    test_config_path.parent.mkdir(parents=True, exist_ok=True)
    test_config_path.write_text(
        '{"status": "ACTIVE", "owner_email": "admin@example.com"}',
        encoding="utf-8",
    )
    monkeypatch.setenv("SETUP_CONFIG_PATH", str(test_config_path))
    setup_manager._custom_config_path = str(test_config_path)
    setup_manager.check_setup_state()
    yield
    if test_config_path.exists():
        test_config_path.unlink()
    setup_manager.check_setup_state()


def test_get_responsible_users_by_category(db_session):
    """
    Requirement 1: When a ticket is created with category C,
    lookup all Users where role='responsible' and assigned_category=C.
    """
    # 1. Matching Responsible user in Finance
    u1 = User(
        email="resp_fin_1@workspace.com",
        password_hash="hash1",
        role=UserRole.RESPONSIBLE,
        assigned_category="Finance",
        is_active=True,
    )
    # 2. Second matching Responsible user in Finance
    u2 = User(
        email="resp_fin_2@workspace.com",
        password_hash="hash2",
        role=UserRole.RESPONSIBLE,
        assigned_category="finance",  # case-insensitive category
        is_active=True,
    )
    # 3. Non-matching category (IT Support)
    u3 = User(
        email="resp_it@workspace.com",
        password_hash="hash3",
        role=UserRole.RESPONSIBLE,
        assigned_category="IT Support",
        is_active=True,
    )
    # 4. Non-matching role (Owner) in Finance
    u4 = User(
        email="owner_fin@workspace.com",
        password_hash="hash4",
        role=UserRole.OWNER,
        assigned_category="Finance",
        is_active=True,
    )
    # 5. Inactive responsible user in Finance
    u5 = User(
        email="inactive_fin@workspace.com",
        password_hash="hash5",
        role=UserRole.RESPONSIBLE,
        assigned_category="Finance",
        is_active=False,
    )

    db_session.add_all([u1, u2, u3, u4, u5])
    db_session.commit()

    # Query with TicketCategory ENUM
    matched_enum = get_responsible_users_for_category(TicketCategory.FINANCE, db_session)
    matched_emails = {u.email for u in matched_enum}
    assert matched_emails == {"resp_fin_1@workspace.com", "resp_fin_2@workspace.com"}

    # Query with exact string
    matched_str = get_responsible_users_for_category("Finance", db_session)
    assert {u.email for u in matched_str} == {"resp_fin_1@workspace.com", "resp_fin_2@workspace.com"}

    # Query with lower-case string
    matched_lower = get_responsible_users_for_category("finance", db_session)
    assert {u.email for u in matched_lower} == {"resp_fin_1@workspace.com", "resp_fin_2@workspace.com"}

    # Query for category with no assigned users
    matched_empty = get_responsible_users_for_category("Operations", db_session)
    assert len(matched_empty) == 0


def test_build_ticket_notification_html_content():
    """
    Requirement 2: Send an HTML email via SMTP to localhost:1025
    containing Ticket ID, Consumer Name, Priority, and AI Summary.
    """
    ticket_id = 105
    consumer_name = "Jane Consumer"
    priority = "High"
    ai_summary = "Customer reports double debit on monthly subscription renewal invoice."
    ticket_title = "Double Billing Incident"
    category = "Finance"

    html_content = build_ticket_notification_html(
        ticket_id=ticket_id,
        consumer_name=consumer_name,
        priority=priority,
        ai_summary=ai_summary,
        ticket_title=ticket_title,
        category=category,
    )

    # Assert required items are present in the HTML output
    assert f"#{ticket_id}" in html_content
    assert consumer_name in html_content
    assert priority in html_content
    assert ai_summary in html_content
    assert ticket_title in html_content
    assert category in html_content
    assert "<!DOCTYPE html>" in html_content
    assert "AI Summary" in html_content

    # Plain text version should also contain all requirements
    text_content = build_ticket_notification_text(
        ticket_id=ticket_id,
        consumer_name=consumer_name,
        priority=priority,
        ai_summary=ai_summary,
        ticket_title=ticket_title,
        category=category,
    )
    assert f"#{ticket_id}" in text_content
    assert consumer_name in text_content
    assert priority in text_content
    assert ai_summary in text_content


def test_send_email_smtp_dispatch():
    """Verify SMTP connection to localhost:1025 and message structure."""
    mock_server = MagicMock()
    mock_smtp_cls = MagicMock(return_value=mock_server)
    mock_server.__enter__.return_value = mock_server

    with patch("smtplib.SMTP", mock_smtp_cls):
        success = send_email(
            to_email="operator@workspace.com",
            subject="New Ticket #101: [High] Critical Bug",
            html_content="<h1>New Ticket</h1>",
            text_content="New Ticket",
            host="localhost",
            port=1025,
            from_email="noreply@ticketworkspace.com",
        )

        assert success is True
        mock_smtp_cls.assert_called_once_with(host="localhost", port=1025, timeout=10.0)
        assert mock_server.sendmail.call_count == 1
        args, kwargs = mock_server.sendmail.call_args
        sender, recipients, msg_str = args
        assert sender == "noreply@ticketworkspace.com"
        assert recipients == ["operator@workspace.com"]
        assert "Subject: New Ticket #101: [High] Critical Bug" in msg_str
        assert "operator@workspace.com" in msg_str


def test_send_ticket_creation_notification_worker(db_session):
    """
    Verify the background task worker looks up responsible users
    and delivers emails via SMTP.
    """
    # Create responsible users
    resp_user1 = User(
        email="legal_lead@workspace.com",
        password_hash="hash",
        role=UserRole.RESPONSIBLE,
        assigned_category="Legal",
    )
    resp_user2 = User(
        email="legal_officer@workspace.com",
        password_hash="hash",
        role=UserRole.RESPONSIBLE,
        assigned_category="Legal",
    )
    db_session.add_all([resp_user1, resp_user2])
    db_session.commit()

    mock_server = MagicMock()
    mock_smtp_cls = MagicMock(return_value=mock_server)
    mock_server.__enter__.return_value = mock_server

    with patch("smtplib.SMTP", mock_smtp_cls):
        sent_count = send_ticket_creation_notification(
            ticket_id=77,
            category="Legal",
            consumer_name="Mark Client",
            priority="High",
            ai_summary="GDPR data export request submitted by enterprise customer.",
            ticket_title="GDPR Data Subject Request",
            db_session=db_session,
            host="localhost",
            port=1025,
        )

        assert sent_count == 2
        assert mock_server.sendmail.call_count == 2

        # Verify sent destinations
        called_recipients = [call[0][1] for call in mock_server.sendmail.call_args_list]
        assert ["legal_lead@workspace.com"] in called_recipients
        assert ["legal_officer@workspace.com"] in called_recipients


def test_create_ticket_endpoint_dispatches_background_task(active_setup, db_session):
    """
    Requirement 3: Keep the email dispatch non-blocking so the consumer receives ticket confirmation instantly.
    Verifies that POST /api/tickets returns HTTP 201 Created immediately and triggers the background task.
    """
    # Override database dependency for TestClient with generator
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    payload = {
        "title": "VPN Gateway Unreachable",
        "description": "Remote employees cannot establish WireGuard tunnel to DC network.",
        "category": "IT Support",
        "priority": "High",
        "status": "Open",
        "consumer_name": "DevOps Engineer",
        "ai_summary": "VPN connection failure affecting remote employees.",
    }

    with patch("app.api.tickets.send_ticket_creation_notification") as mock_task:
        with TestClient(app) as client:
            resp = client.post("/api/tickets", json=payload)
            assert resp.status_code == 201
            data = resp.json()

            # Consumer receives instant confirmation
            assert data["id"] is not None
            assert data["title"] == "VPN Gateway Unreachable"
            assert data["category"] == "IT Support"
            assert data["priority"] == "High"
            assert data["consumer_name"] == "DevOps Engineer"
            assert data["ai_summary"] == "VPN connection failure affecting remote employees."

            # Verify background task was enqueued with proper arguments
            mock_task.assert_called_once_with(
                ticket_id=data["id"],
                category="IT Support",
                consumer_name="DevOps Engineer",
                priority="High",
                ai_summary="VPN connection failure affecting remote employees.",
                ticket_title="VPN Gateway Unreachable",
            )

    app.dependency_overrides.clear()


def test_smtp_failure_resilience():
    """Verify that SMTP connection refusal or network failure is handled gracefully without crashing."""
    mock_smtp_cls = MagicMock(side_effect=ConnectionRefusedError("Connection refused to localhost:1025"))

    with patch("smtplib.SMTP", mock_smtp_cls):
        success = send_email(
            to_email="test@workspace.com",
            subject="Test Failure",
            html_content="<p>Test</p>",
            host="localhost",
            port=1025,
        )
        assert success is False
