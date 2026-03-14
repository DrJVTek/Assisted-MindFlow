"""Encrypted token storage service for OAuth sessions.

Uses Fernet symmetric encryption with a machine-derived key (PBKDF2 from
hostname + username + salt file) to securely persist OAuth tokens at rest.

Supports per-provider session storage: each provider gets its own encrypted file.
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
DEFAULT_OAUTH_DIR = Path("data/oauth")
DEFAULT_SALT_PATH = Path("data/oauth/.salt")

# Legacy single-session path (for migration)
LEGACY_SESSION_PATH = Path("data/oauth/session.enc")


class TokenStorage:
    """Handles encrypted persistence of OAuth session tokens.

    Stores one encrypted session file per provider: data/oauth/{provider_id}.session.enc
    """

    def __init__(
        self,
        oauth_dir: Optional[Path] = None,
        salt_path: Optional[Path] = None,
    ):
        self._oauth_dir = oauth_dir or DEFAULT_OAUTH_DIR
        self._salt_path = salt_path or DEFAULT_SALT_PATH

    def _session_path_for(self, provider_id: str) -> Path:
        """Get the session file path for a specific provider."""
        return self._oauth_dir / f"{provider_id}.session.enc"

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

    def save_session(self, session: OAuthSession, provider_id: str) -> None:
        """Encrypt and persist an OAuth session to disk."""
        fernet = self._get_fernet()
        plaintext = json.dumps(session.to_storage_dict()).encode("utf-8")
        encrypted = fernet.encrypt(plaintext)

        path = self._session_path_for(provider_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encrypted)
        logger.info("OAuth session saved for provider %s", provider_id)

    def load_session(self, provider_id: str) -> Optional[OAuthSession]:
        """Load and decrypt an OAuth session from disk. Returns None if missing or corrupt."""
        path = self._session_path_for(provider_id)
        if not path.exists():
            return None

        try:
            fernet = self._get_fernet()
            encrypted = path.read_bytes()
            plaintext = fernet.decrypt(encrypted)
            data = json.loads(plaintext.decode("utf-8"))
            return OAuthSession.from_storage_dict(data)
        except InvalidToken:
            logger.error("Failed to decrypt session for provider %s — key mismatch", provider_id)
            return None
        except (json.JSONDecodeError, Exception) as exc:
            logger.error("Failed to load OAuth session for provider %s: %s", provider_id, exc)
            return None

    def delete_session(self, provider_id: str) -> bool:
        """Delete the encrypted session file. Returns True if file was removed."""
        path = self._session_path_for(provider_id)
        if path.exists():
            path.unlink()
            logger.info("OAuth session deleted for provider %s", provider_id)
            return True
        return False

    def has_session(self, provider_id: str) -> bool:
        """Check if an encrypted session file exists for the given provider."""
        return self._session_path_for(provider_id).exists()

    def migrate_legacy_session(self, provider_id: str) -> bool:
        """Migrate the old single-session file to per-provider format.

        Returns True if a legacy session was migrated.
        """
        if not LEGACY_SESSION_PATH.exists():
            return False

        # Already has a per-provider session — don't overwrite
        if self.has_session(provider_id):
            return False

        try:
            fernet = self._get_fernet()
            encrypted = LEGACY_SESSION_PATH.read_bytes()
            plaintext = fernet.decrypt(encrypted)
            data = json.loads(plaintext.decode("utf-8"))
            session = OAuthSession.from_storage_dict(data)
            session.provider_id = provider_id

            self.save_session(session, provider_id)
            LEGACY_SESSION_PATH.unlink()
            logger.info("Migrated legacy OAuth session to provider %s", provider_id)
            return True
        except Exception as exc:
            logger.error("Failed to migrate legacy session: %s", exc)
            return False
