import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Guarantee backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.setup import setup_manager
from app.main import app
from app.models.enums import TicketCategory, TicketPriority
from app.schemas.ai import TicketClassification, TicketTriageRequest
from app.services.triage import (
    aclassify_ticket,
    classify_ticket,
    fallback_classify_ticket,
)


@pytest.fixture(autouse=True)
def clean_environment(tmp_path, monkeypatch):
    """Isolate setup state and environment variables for each test."""
    test_config_path = tmp_path / "config" / "setup_state.json"
    monkeypatch.setenv("SETUP_CONFIG_PATH", str(test_config_path))
    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key-12345678901234567890")
    setup_manager._custom_config_path = str(test_config_path)
    setup_manager.check_setup_state()
    yield
    if test_config_path.exists():
        test_config_path.unlink()
    setup_manager.check_setup_state()


def test_schema_matches_database_enums():
    """Verify TicketClassification allowed values strictly match database enums."""
    db_categories = {c.value for c in TicketCategory}
    db_priorities = {p.value for p in TicketPriority}

    # Verify our defined categories match DB enum
    expected_categories = {
        "Finance",
        "Legal",
        "Operations",
        "IT Support",
        "Human Resources",
        "Customer Success",
    }
    expected_priorities = {"High", "Medium", "Low"}

    assert db_categories == expected_categories
    assert db_priorities == expected_priorities

    # Instantiating valid model
    model = TicketClassification(
        category="Finance",
        priority="High",
        summary="Payment failed due to invalid card token.",
    )
    assert model.category in db_categories
    assert model.priority in db_priorities
    assert model.summary.startswith("Payment failed")


def test_classify_ticket_successful_gemini_call(monkeypatch):
    """Verify classify_ticket initializes google-genai client and parses structured JSON output."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "category": "Finance",
        "priority": "High",
        "summary": "Customer requesting a refund for duplicate billing charges.",
    })

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client) as mock_client_cls:
        result = classify_ticket(
            consumer_name="Alice Smith",
            request_text="I was charged twice on my credit card for invoice #9821. Please refund immediately.",
            attachment_url="https://example.com/receipt.pdf",
        )

        # Assert client initialized with API key
        mock_client_cls.assert_called_once_with(api_key="test-api-key-12345678901234567890")

        # Assert generate_content called with active model
        args, kwargs = mock_client.models.generate_content.call_args
        assert kwargs["model"] in ("gemini-2.5-flash", "gemini-flash-latest")
        assert "Alice Smith" in kwargs["contents"]
        assert "https://example.com/receipt.pdf" in kwargs["contents"]

        # Assert structured output adhered to schema
        assert isinstance(result, TicketClassification)
        assert result.category == "Finance"
        assert result.priority == "High"
        assert "duplicate billing" in result.summary


def test_classify_ticket_network_timeout_triggers_fallback(monkeypatch):
    """Verify network timeout triggers fallback heuristic logic seamlessly without crashing."""
    mock_client = MagicMock()
    # Simulate network timeout during generate_content call
    mock_client.models.generate_content.side_effect = httpx.TimeoutException("Connection timed out after 10.0s")

    with patch("google.genai.Client", return_value=mock_client):
        # 1. Critical IT outage query
        result = classify_ticket(
            consumer_name="Bob Engineer",
            request_text="Production database server crashed! VPN and login are down, critical outage.",
            attachment_url=None,
        )

        assert isinstance(result, TicketClassification)
        assert result.category == "IT Support"
        assert result.priority == "High"
        assert len(result.summary) > 0

        # 2. Minor feedback query
        result_low = classify_ticket(
            consumer_name="Charlie Client",
            request_text="Minor suggestion regarding the font color on the dashboard. No rush, just cosmetic feedback.",
            attachment_url=None,
        )

        assert isinstance(result_low, TicketClassification)
        assert result_low.priority == "Low"


def test_fallback_heuristic_domain_categories():
    """Verify the heuristic fallback correctly classifies various domain categories."""
    samples = [
        ("Acme Corp", "Need updated invoice and wire instructions for monthly billing tax.", "Finance"),
        ("Legal Counsel", "Please review the updated vendor NDA and GDPR compliance policy terms of service.", "Legal"),
        ("Facility Dept", "Datacenter server rack chiller unit failure, logistics maintenance required.", "Operations"),
        ("Jane Doe", "Cannot login to company SSO portal, password reset link gives error.", "IT Support"),
        ("HR Rep", "Questions regarding employee PTO vacation policy and healthcare benefits salary.", "Human Resources"),
        ("Client Exec", "Looking to renew annual enterprise subscription contract and discuss client satisfaction.", "Customer Success"),
    ]

    for consumer, text, expected_category in samples:
        classification = fallback_classify_ticket(consumer, text, reason="test")
        assert classification.category == expected_category, f"Expected {expected_category} for: {text}"
        assert classification.priority in {"High", "Medium", "Low"}
        assert len(classification.summary) > 0


@pytest.mark.asyncio
async def test_async_classify_ticket(monkeypatch):
    """Verify asynchronous aclassify_ticket works with client.aio."""
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "category": "Operations",
        "priority": "Medium",
        "summary": "Office facilities request for desk maintenance.",
    })

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    with patch("google.genai.Client", return_value=mock_client):
        result = await aclassify_ticket(
            consumer_name="Facility Manager",
            request_text="Please replace fluorescent tubes in 3rd floor office.",
            attachment_url=None,
        )

        assert isinstance(result, TicketClassification)
        assert result.category == "Operations"
        assert result.priority == "Medium"


@pytest.mark.asyncio
async def test_dual_sync_and_await_behavior():
    """Verify classify_ticket can be either assigned directly or awaited."""
    # 1. Sync invocation
    res_sync = fallback_classify_ticket("User", "SSO login down")
    assert res_sync.category == "IT Support"

    # 2. Awaitable invocation
    res_awaited = await fallback_classify_ticket("User", "SSO login down")
    assert res_awaited.category == "IT Support"


def test_health_check_reports_ai_configured(tmp_path, monkeypatch):
    """Verify /health endpoint accurately reflects AI configuration and setup status."""
    # Make setup active
    test_config = tmp_path / "config" / "setup_state.json"
    test_config.parent.mkdir(parents=True, exist_ok=True)
    test_config.write_text(json.dumps({
        "status": "ACTIVE",
        "owner_email": "owner@example.com",
        "gemini_api_key": "active-gemini-key-12345",
    }), encoding="utf-8")
    setup_manager._custom_config_path = str(test_config)
    setup_manager.check_setup_state()

    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["setup_required"] is False
        assert "ai" in data
        assert data["ai"]["configured"] is True
        assert data["ai"]["model"] in ("gemini-flash-latest", "gemini-2.5-flash")


def test_api_triage_endpoints(tmp_path):
    """Verify POST /api/tickets/triage and /api/tickets/classify endpoints."""
    test_config = tmp_path / "config" / "setup_state.json"
    test_config.parent.mkdir(parents=True, exist_ok=True)
    test_config.write_text(json.dumps({
        "status": "ACTIVE",
        "owner_email": "owner@example.com",
        "gemini_api_key": "active-gemini-key-12345",
    }), encoding="utf-8")
    setup_manager._custom_config_path = str(test_config)
    setup_manager.check_setup_state()

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "category": "Customer Success",
        "priority": "Medium",
        "summary": "Customer asking for an onboarding demo walkthrough.",
    })

    mock_client = MagicMock()
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    with patch("google.genai.Client", return_value=mock_client), TestClient(app) as client:
        payload = {
            "consumer_name": "Sarah Connor",
            "request_text": "We would like to schedule a demo session for the new team members.",
            "attachment_url": "https://example.com/agenda.pdf",
        }

        # 1. Test /api/tickets/triage
        resp_triage = client.post("/api/tickets/triage", json=payload)
        assert resp_triage.status_code == 200
        data_triage = resp_triage.json()
        assert data_triage["category"] == "Customer Success"
        assert data_triage["priority"] == "Medium"
        assert "onboarding demo" in data_triage["summary"]

        # 2. Test /api/tickets/classify alias
        resp_classify = client.post("/api/tickets/classify", json=payload)
        assert resp_classify.status_code == 200
        data_classify = resp_classify.json()
        assert data_classify["category"] == "Customer Success"


def test_fallback_summary_extracts_actual_problem_not_subject():
    """Verify fallback summary uses the detailed description and not just the subject/title."""
    # Case 1: Separate title and large description
    res1 = fallback_classify_ticket(
        consumer_name="Pepita",
        title="Problema.",
        description="Al revisar la factura de este mes me di cuenta que me cobraron dos veces el mismo servicio por un total de 120 dólares. Solicito por favor que me hagan el reembolso correspondiente.",
        reason="test",
    )
    assert res1.category == "Finance"
    assert "Problema." not in res1.summary
    assert "cobraron dos veces" in res1.summary or "factura" in res1.summary

    # Case 2: Combined request_text formatted as Subject: ... \n\n Issue Details: ...
    combined = "Subject: Problema.\n\nIssue Details:\nMi cuenta de usuario fue bloqueada tras varios intentos de login. Necesito restablecer mi contraseña de inmediato para acceder al servidor."
    res2 = fallback_classify_ticket(
        consumer_name="Pepita",
        request_text=combined,
        reason="test",
    )
    assert res2.category == "IT Support"
    assert "Subject: Problema" not in res2.summary
    assert "bloqueada" in res2.summary or "contraseña" in res2.summary
