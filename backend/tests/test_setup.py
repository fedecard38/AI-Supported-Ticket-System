import json
import os
import sys
from pathlib import Path

# Guarantee backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

from app.core.setup import hash_password, setup_manager, verify_password
from app.main import app


@pytest.fixture(autouse=True)
def clean_setup_environment(tmp_path, monkeypatch):
    """
    Ensure each test runs in an isolated temporary configuration environment.
    """
    test_config_path = tmp_path / "config" / "setup_state.json"
    monkeypatch.setenv("SETUP_CONFIG_PATH", str(test_config_path))
    setup_manager._custom_config_path = str(test_config_path)
    setup_manager.check_setup_state()
    yield test_config_path
    if test_config_path.exists():
        test_config_path.unlink()
    setup_manager.check_setup_state()


def test_password_hashing_and_verification():
    """Verify PBKDF2 password hashing security and constant-time verification."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("pbkdf2_sha256$")
    assert password not in hashed
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_uninitialized_system_intercepts_api_calls_with_428():
    """
    Requirement 1 & 2: When setup_state.json is absent, intercept API calls
    and return HTTP 428 Precondition Required {"setup_required": true}.
    """
    with TestClient(app) as client:
        # Standard endpoints must return HTTP 428
        resp_root = client.get("/")
        assert resp_root.status_code == 428
        assert resp_root.json() == {"setup_required": True}

        resp_health = client.get("/health")
        assert resp_health.status_code == 428
        assert resp_health.json() == {"setup_required": True}

        # Setup status and OpenAPI endpoints must NOT be blocked
        resp_status = client.get("/api/setup/status")
        assert resp_status.status_code == 200
        assert resp_status.json()["setup_required"] is True
        assert resp_status.json()["status"] == "UNINITIALIZED"

        resp_docs = client.get("/docs")
        assert resp_docs.status_code == 200

        resp_openapi = client.get("/openapi.json")
        assert resp_openapi.status_code == 200


def test_cors_options_preflight_allowed_when_uninitialized():
    """OPTIONS preflight requests must pass through to avoid breaking browsers."""
    with TestClient(app) as client:
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_initialize_validation_failures():
    """Verify robust validation of owner email, password strength, and gemini key."""
    with TestClient(app) as client:
        # 1. Invalid email
        payload = {
            "owner_email": "invalid-email-address",
            "owner_password": "ValidPassword123!",
            "gemini_api_key": "AIzaSyFakeValidKeyLongEnough123456789",
            "db_settings": {
                "host": "postgres",
                "port": 5432,
                "db_name": "ticket_system",
                "user": "postgres",
                "password": "secret_password",
            },
            "validate_external": False,
        }
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 422

        # 2. Weak password (no special char, no uppercase)
        payload["owner_email"] = "admin@example.com"
        payload["owner_password"] = "simplepassword"
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 422
        assert "Password must contain at least one uppercase letter" in resp.text

        # 3. Short Gemini API key
        payload["owner_password"] = "StrongPassword123!"
        payload["gemini_api_key"] = "short"
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 422


def test_successful_initialization_and_access_grant(clean_setup_environment):
    """
    Requirement 3: POST /api/setup/initialize writes configuration,
    sets state to ACTIVE, and allows subsequent API calls.
    """
    test_config_file = clean_setup_environment

    payload = {
        "owner_email": "owner@example.com",
        "owner_password": "MasterAdminPassword123!",
        "gemini_api_key": "AIzaSyTestKeyLongEnoughString12345",
        "db_settings": {
            "host": "postgres",
            "port": 5432,
            "db_name": "ticket_system",
            "user": "postgres",
            "password": "postgres_db_password",
        },
        "validate_external": False,
    }

    with TestClient(app) as client:
        # Initialize
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "ACTIVE"
        assert data["setup_required"] is False
        assert data["owner_email"] == "owner@example.com"

        # Verify config file exists on disk
        assert test_config_file.is_file()
        with open(test_config_file, "r", encoding="utf-8") as f:
            saved_config = json.load(f)

        assert saved_config["status"] == "ACTIVE"
        assert saved_config["owner_email"] == "owner@example.com"
        assert "MasterAdminPassword123!" not in str(saved_config)  # Plaintext password never stored
        assert saved_config["owner_password_hash"].startswith("pbkdf2_sha256$")
        assert saved_config["gemini_api_key"] == "AIzaSyTestKeyLongEnoughString12345"

        # Subsequent API calls to root and health must now return 200
        resp_root = client.get("/")
        assert resp_root.status_code == 200
        assert resp_root.json()["status"] == "healthy"

        resp_health = client.get("/health")
        assert resp_health.status_code == 200
        assert resp_health.json()["status"] == "ok"

        # Calling initialize again while ACTIVE must return 409 Conflict
        resp_conflict = client.post("/api/setup/initialize", json=payload)
        assert resp_conflict.status_code == 409


def test_factory_reset_protected_by_master_password(clean_setup_environment):
    """
    Requirement 4: POST /api/setup/factory-reset, protected by Owner master password,
    resets instance to factory state.
    """
    test_config_file = clean_setup_environment
    master_password = "MasterAdminPassword123!"

    # First initialize
    init_payload = {
        "owner_email": "owner@example.com",
        "owner_password": master_password,
        "gemini_api_key": "AIzaSyTestKeyLongEnoughString12345",
        "db_settings": {
            "host": "postgres",
            "port": 5432,
            "db_name": "ticket_system",
            "user": "postgres",
            "password": "db_password",
        },
        "validate_external": False,
    }

    with TestClient(app) as client:
        client.post("/api/setup/initialize", json=init_payload)
        assert test_config_file.is_file()
        assert client.get("/health").status_code == 200

        # Attempt factory reset with WRONG password
        bad_reset = client.post(
            "/api/setup/factory-reset",
            json={"owner_password": "WrongPassword123!"},
        )
        assert bad_reset.status_code == 401
        assert "Invalid Owner master password" in bad_reset.text
        # Config file must still be intact
        assert test_config_file.is_file()

        # Perform factory reset with CORRECT master password
        good_reset = client.post(
            "/api/setup/factory-reset",
            json={"owner_password": master_password},
        )
        assert good_reset.status_code == 200
        assert good_reset.json()["setup_required"] is True

        # Config file must be deleted
        assert not test_config_file.is_file()

        # API calls must now return HTTP 428 Precondition Required again!
        resp_health = client.get("/health")
        assert resp_health.status_code == 428
        assert resp_health.json() == {"setup_required": True}

        # Factory reset on already uninitialized instance returns 400
        reset_again = client.post(
            "/api/setup/factory-reset",
            json={"owner_password": master_password},
        )
        assert reset_again.status_code == 400


def test_cors_headers_included_on_428_response():
    """Verify that 428 responses properly attach CORS headers so browsers don't fail."""
    with TestClient(app) as client:
        resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
        assert resp.status_code == 428
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert resp.json() == {"setup_required": True}


def test_corrupted_config_file_handled_gracefully(clean_setup_environment):
    """If setup_state.json contains invalid JSON or invalid status, intercept with 428."""
    test_config_file = clean_setup_environment
    test_config_file.parent.mkdir(parents=True, exist_ok=True)
    with open(test_config_file, "w", encoding="utf-8") as f:
        f.write("{ invalid json")

    setup_manager.check_setup_state()
    assert setup_manager.is_active() is False

    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 428


def test_gemini_invalid_key_validation_error(monkeypatch):
    """Gemini API validation fails when an invalid key is rejected by Google API."""
    async def mock_gemini_rejection(self, key, validate_external=True):
        raise ValueError("Gemini API Key verification failed: API key not valid.")

    monkeypatch.setattr(
        "app.core.setup.SetupManager.validate_gemini_api_key",
        mock_gemini_rejection,
    )

    payload = {
        "owner_email": "admin@example.com",
        "owner_password": "ValidPassword123!",
        "gemini_api_key": "AIzaSyTestKeyLongEnoughString12345",
        "db_settings": {
            "host": "localhost",
            "port": 5432,
            "db_name": "ticket_system",
            "user": "postgres",
            "password": "password",
        },
        "validate_external": True,
    }
    with TestClient(app) as client:
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 400
        assert "Gemini API Key verification failed" in resp.json()["detail"]


def test_db_unreachable_validation_error(monkeypatch):
    """Validation fails cleanly when external database cannot be reached."""
    # Mock Gemini validation to pass so we can isolate DB connectivity test
    async def mock_validate_gemini(self, key, validate_external=True):
        return True

    monkeypatch.setattr(
        "app.core.setup.SetupManager.validate_gemini_api_key",
        mock_validate_gemini,
    )

    payload = {
        "owner_email": "admin@example.com",
        "owner_password": "ValidPassword123!",
        "gemini_api_key": "AIzaSyTestKeyLongEnoughString12345",
        "db_settings": {
            # Use non-routable IP address / port that fails connection
            "host": "192.0.2.1",
            "port": 5432,
            "db_name": "ticket_system",
            "user": "postgres",
            "password": "password",
        },
        "validate_external": True,
    }
    with TestClient(app) as client:
        resp = client.post("/api/setup/initialize", json=payload)
        assert resp.status_code == 400
        assert "Could not connect to database" in resp.json()["detail"]


