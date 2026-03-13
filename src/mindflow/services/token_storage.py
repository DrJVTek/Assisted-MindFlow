"""Encrypted token storage service for OAuth sessions.

Uses Fernet symmetric encryption with a machine-derived key (PBKDF2 from
hostname + username + salt file) to securely persist OAuth tokens at rest.
"""

import base64
import json
import logging
import os
import platform
import getpass
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from mindflow.models.oauth_session import OAuthSession

logger = logging.getLogger(__name__)

SALT_SIZE = 32
PBKDF2_ITERATIONS = 480_000
DEFAULT_SESSION_PATH = Path("data/oauth/session.enc")
DEFAULT_SALT_PATH = Path("data/oauth/.salt")


class TokenStorage:
    """Handles encrypted persistence of OAuth session tokens."""

    def __init__(
        self,
        session_path: Optional[Path] = None,
        salt_path: Optional[Path] = None,
    ):
        self._session_path = session_path or DEFAULT_SESSION_PATH
        self._salt_path = salt_path or DEFAULT_SALT_PATH

    def _get_or_create_salt(self) -> bytes:
        """Load existing salt or generate a new one on first use."""
        if self._salt_path.exists():
            return self._salt_path.read_bytes()

        self._salt_path.parent.mkdir(parents=True, exist_ok=True)
        salt = os.urandom(SALT_SIZE)
        self._salt_path.write_bytes(salt)
        logger.info("Generated new encryption salt at %s", self._salt_path)
        return salt

    def _derive_key(self, salt: bytes) -> bytes:
        """Derive Fernet key from machine-specific identifiers + salt."""
        machine_id = f"{platform.node()}:{getpass.getuser()}"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=PBKDF2_ITERATIONS,
        )
        key = kdf.derive(machine_id.encode("utf-8"))
        return base64.urlsafe_b64encode(key)

    def _get_fernet(self) -> Fernet:
        """Create a Fernet instance with the machine-derived key."""
        salt = self._get_or_create_salt()
        key = self._derive_key(salt)
        return Fernet(key)

    def save_session(self, session: OAuthSession) -> None:
        """Encrypt and persist an OAuth session to disk."""
        fernet = self._get_fernet()
        plaintext = json.dumps(session.to_storage_dict()).encode("utf-8")
        encrypted = fernet.encrypt(plaintext)

        self._session_path.parent.mkdir(parents=True, exist_ok=True)
        self._session_path.write_bytes(encrypted)
        logger.info("OAuth session saved to %s", self._session_path)

    def load_session(self) -> Optional[OAuthSession]:
        """Load and decrypt an OAuth session from disk. Returns None if missing or corrupt."""
        if not self._session_path.exists():
            return None

        try:
            fernet = self._get_fernet()
            encrypted = self._session_path.read_bytes()
            plaintext = fernet.decrypt(encrypted)
            data = json.loads(plaintext.decode("utf-8"))
            return OAuthSession.from_storage_dict(data)
        except InvalidToken:
            logger.error("Failed to decrypt session file — key mismatch or corrupted data")
            return None
        except (json.JSONDecodeError, Exception) as exc:
            logger.error("Failed to load OAuth session: %s", exc)
            return None

    def delete_session(self) -> bool:
        """Delete the encrypted session file. Returns True if file was removed."""
        if self._session_path.exists():
            self._session_path.unlink()
            logger.info("OAuth session deleted from %s", self._session_path)
            return True
        return False

    def has_session(self) -> bool:
        """Check if an encrypted session file exists."""
        return self._session_path.exists()
