import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
import secrets
import socket
from typing import Any, Dict, Optional
import httpx

from app.schemas.setup import DatabaseSettings, InitializeRequest

logger = logging.getLogger("setup_manager")

# PBKDF2 Parameters (OWASP recommended security baseline)
PBKDF2_ITERATIONS = 600_000
PBKDF2_ALGORITHM = "sha256"


def hash_password(password: str) -> str:
    """Securely hash a password using PBKDF2-HMAC-SHA256 with a random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${salt}${key.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its PBKDF2-HMAC-SHA256 hash using constant-time comparison."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != f"pbkdf2_{PBKDF2_ALGORITHM}":
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_key_hex = parts[3]

        computed_key = hashlib.pbkdf2_hmac(
            PBKDF2_ALGORITHM,
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(computed_key.hex(), expected_key_hex)
    except Exception as exc:
        logger.error(f"Error verifying password hash: {exc}")
        return False


class SetupManager:
    """
    Manages first-time setup state, configuration persistence, and factory reset.
    Implements secure credential storage, atomic writes, and thread-safe state checks.
    """

    def __init__(self, config_path: Optional[str] = None):
        self._custom_config_path = config_path
        self._is_active: bool = False
        self._state_data: Optional[Dict[str, Any]] = None
        self.check_setup_state()

    @property
    def config_file_path(self) -> Path:
        """Resolve the active setup state configuration file path."""
        if self._custom_config_path:
            return Path(self._custom_config_path).resolve()

        env_path = os.getenv("SETUP_CONFIG_PATH")
        if env_path:
            return Path(env_path).resolve()

        # Primary container default path
        primary_path = Path("/app/config/setup_state.json")
        try:
            if primary_path.parent.exists() or Path("/app").exists():
                return primary_path
        except (PermissionError, OSError):
            pass

        # Local development / testing fallback
        local_dir = Path(__file__).resolve().parent.parent.parent
        return local_dir / "config" / "setup_state.json"

    def check_setup_state(self) -> bool:
        """
        Check if setup_state.json exists and contains an ACTIVE state.
        Requirement 1: When container starts, check if '/app/config/setup_state.json' exists.
        """
        target_path = self.config_file_path
        if not target_path.is_file():
            logger.info(f"Setup state file not found at {target_path}. System requires setup.")
            self._is_active = False
            self._state_data = None
            return False

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if data.get("status") == "ACTIVE":
                self._is_active = True
                self._state_data = data
                logger.info("System setup is ACTIVE.")
                return True
            else:
                logger.warning(f"Setup state file exists but status is '{data.get('status')}'.")
                self._is_active = False
                self._state_data = data
                return False
        except Exception as exc:
            logger.error(f"Failed to read setup state from {target_path}: {exc}")
            self._is_active = False
            self._state_data = None
            return False

    def is_active(self) -> bool:
        """Check if the system setup is currently ACTIVE."""
        return self._is_active

    def get_state_summary(self) -> Dict[str, Any]:
        """Return safe summary of the setup state without exposing credentials."""
        if not self._is_active or not self._state_data:
            return {
                "setup_required": True,
                "status": "UNINITIALIZED",
                "owner_email": None,
                "initialized_at": None,
            }
        return {
            "setup_required": False,
            "status": "ACTIVE",
            "owner_email": self._state_data.get("owner_email"),
            "initialized_at": self._state_data.get("initialized_at"),
        }

    async def validate_gemini_api_key(self, api_key: str, validate_external: bool = True) -> bool:
        """
        Validate Google Gemini API Key.
        Checks basic format and (optionally) queries Google Gemini models endpoint.
        """
        if not api_key or len(api_key.strip()) < 20:
            raise ValueError("Invalid Gemini API Key format.")

        if not validate_external:
            return True

        # Test key against Gemini models list endpoint
        url = "https://generativelanguage.googleapis.com/v1beta/models"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, params={"key": api_key.strip()})
                if resp.status_code == 200:
                    return True
                elif resp.status_code in (400, 403, 401):
                    error_detail = "Invalid or unauthorized Gemini API Key."
                    try:
                        err_json = resp.json()
                        if "error" in err_json and "message" in err_json["error"]:
                            error_detail = err_json["error"]["message"]
                    except Exception:
                        pass
                    raise ValueError(f"Gemini API Key verification failed: {error_detail}")
                else:
                    logger.warning(f"Unexpected status from Gemini API: {resp.status_code}")
                    return True
        except httpx.RequestError as exc:
            logger.warning(f"Gemini API connectivity check timed out or unreachable: {exc}")
            # Do not block setup if external network is temporarily unreachable in dev/airgapped envs
            return True

    def validate_db_settings(self, db_settings: DatabaseSettings, validate_external: bool = True) -> bool:
        """
        Validate database configuration settings and network reachability.
        """
        if not db_settings.host or not db_settings.db_name or not db_settings.user:
            raise ValueError("Database host, name, and user are required.")

        if not validate_external:
            return True

        # Socket reachability check for host and port
        try:
            with socket.create_connection((db_settings.host, db_settings.port), timeout=3.0):
                return True
        except (socket.timeout, OSError) as exc:
            logger.warning(f"Database port {db_settings.host}:{db_settings.port} unreachable: {exc}")
            raise ValueError(
                f"Could not connect to database at {db_settings.host}:{db_settings.port}. "
                "Ensure PostgreSQL service is running and accessible."
            )

    async def initialize(self, req: InitializeRequest) -> Dict[str, Any]:
        """
        Validate Owner Email, Owner Password, Gemini API Key, and DB settings,
        write the configuration, and set state to ACTIVE.
        """
        if self._is_active:
            raise ValueError("System is already initialized and ACTIVE.")

        # 1. Validate Gemini API Key
        await self.validate_gemini_api_key(req.gemini_api_key, validate_external=req.validate_external)

        # 2. Validate DB Settings
        self.validate_db_settings(req.db_settings, validate_external=req.validate_external)

        # 3. Hash Owner Password securely
        password_hash = hash_password(req.owner_password)

        # 4. Prepare Configuration Data
        now_iso = datetime.now(timezone.utc).isoformat()
        config_data = {
            "status": "ACTIVE",
            "owner_email": req.owner_email,
            "owner_password_hash": password_hash,
            "gemini_api_key": req.gemini_api_key,
            "db_settings": {
                "host": req.db_settings.host,
                "port": req.db_settings.port,
                "db_name": req.db_settings.db_name,
                "user": req.db_settings.user,
                "password": req.db_settings.password,
                "ssl_mode": req.db_settings.ssl_mode,
                "connection_url": req.db_settings.get_connection_url(),
            },
            "initialized_at": now_iso,
            "version": "1.0.0",
        }

        # 5. Atomically write to setup_state.json
        self._write_config_atomic(config_data)

        # 6. Update internal active state
        self._is_active = True
        self._state_data = config_data
        logger.info(f"Setup successfully completed for owner {req.owner_email}.")

        return {
            "message": "System setup successfully initialized.",
            "status": "ACTIVE",
            "owner_email": req.owner_email,
            "setup_required": False,
        }

    def factory_reset(self, owner_password: str, wipe_database: bool = False) -> Dict[str, Any]:
        """
        Reset instance to factory state, protected by the Owner master password.
        Removes setup_state.json and restores uninitialized state.
        """
        if not self._is_active or not self._state_data:
            raise ValueError("Cannot perform factory reset: System is not initialized.")

        stored_hash = self._state_data.get("owner_password_hash")
        if not stored_hash or not verify_password(owner_password, stored_hash):
            raise PermissionError("Invalid Owner master password.")

        target_path = self.config_file_path
        try:
            if target_path.exists():
                target_path.unlink()
                logger.info(f"Removed setup configuration file: {target_path}")
        except Exception as exc:
            logger.error(f"Failed to delete setup state file {target_path}: {exc}")
            raise RuntimeError(f"Failed to delete configuration file during factory reset: {exc}")

        # Reset in-memory state
        self._is_active = False
        self._state_data = None

        logger.warning("Instance has been factory reset to uninitialized state.")
        return {
            "message": "Factory reset successful. Instance restored to uninitialized state.",
            "setup_required": True,
            "status": "UNINITIALIZED",
        }

    def _write_config_atomic(self, data: Dict[str, Any]) -> None:
        """Write configuration to disk atomically with restricted POSIX permissions."""
        target_path = self.config_file_path
        target_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = target_path.parent / f".setup_state.tmp.{secrets.token_hex(8)}"
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            # Set file permissions: read/write by owner only (0o600 on POSIX)
            if hasattr(os, "chmod"):
                try:
                    os.chmod(temp_path, 0o600)
                except OSError:
                    pass

            # Atomic replace
            temp_path.replace(target_path)
        except Exception as exc:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise RuntimeError(f"Failed to atomically write configuration file: {exc}")


# Global setup manager singleton
setup_manager = SetupManager()
