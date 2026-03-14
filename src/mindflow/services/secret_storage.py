"""Encrypted credential storage for LLM provider API keys and tokens.

Uses Fernet symmetric encryption with a machine-derived key file.
The key is auto-generated on first use and persists across restarts.
No user password required.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from mindflow.models.provider import ProviderCredentials

logger = logging.getLogger(__name__)

DEFAULT_SECRETS_DIR = Path("data/secrets")
KEY_FILE = ".key"
CREDENTIALS_FILE = "providers.enc"


class SecretStorage:
    """Manages encrypted storage of provider credentials.

    Uses Fernet (AES-128-CBC + HMAC) with a machine-derived key file.
    Key file is auto-generated on first use.
    """

    def __init__(self, secrets_dir: Optional[Path] = None):
        self._secrets_dir = secrets_dir or DEFAULT_SECRETS_DIR
        self._secrets_dir.mkdir(parents=True, exist_ok=True)
        self._key_path = self._secrets_dir / KEY_FILE
        self._creds_path = self._secrets_dir / CREDENTIALS_FILE
        self._fernet: Optional[Fernet] = None

    def _get_fernet(self) -> Fernet:
        """Get or create the Fernet encryption instance."""
        if self._fernet is not None:
            return self._fernet

        if self._key_path.exists():
            key = self._key_path.read_bytes()
        else:
            key = Fernet.generate_key()
            self._key_path.write_bytes(key)
            logger.info("Generated new encryption key at %s", self._key_path)

        self._fernet = Fernet(key)
        return self._fernet

    def _load_all(self) -> dict[str, ProviderCredentials]:
        """Load all credentials from encrypted file."""
        if not self._creds_path.exists():
            return {}

        try:
            fernet = self._get_fernet()
            encrypted = self._creds_path.read_bytes()
            decrypted = fernet.decrypt(encrypted)
            data = json.loads(decrypted.decode("utf-8"))
            return {
                pid: ProviderCredentials(**creds)
                for pid, creds in data.items()
            }
        except (InvalidToken, json.JSONDecodeError, Exception) as exc:
            logger.error("Failed to load credentials: %s", exc)
            return {}

    def _save_all(self, credentials: dict[str, ProviderCredentials]) -> None:
        """Save all credentials to encrypted file."""
        fernet = self._get_fernet()
        data = {
            pid: creds.model_dump(mode="json")
            for pid, creds in credentials.items()
        }
        plaintext = json.dumps(data).encode("utf-8")
        encrypted = fernet.encrypt(plaintext)
        self._creds_path.write_bytes(encrypted)

    def save_credentials(self, credentials: ProviderCredentials) -> None:
        """Save or update credentials for a provider."""
        all_creds = self._load_all()
        all_creds[str(credentials.provider_id)] = credentials
        self._save_all(all_creds)
        logger.info("Saved credentials for provider %s", credentials.provider_id)

    def get_credentials(self, provider_id: str) -> Optional[ProviderCredentials]:
        """Get credentials for a specific provider."""
        all_creds = self._load_all()
        return all_creds.get(provider_id)

    def delete_credentials(self, provider_id: str) -> bool:
        """Delete credentials for a specific provider."""
        all_creds = self._load_all()
        if provider_id in all_creds:
            del all_creds[provider_id]
            self._save_all(all_creds)
            logger.info("Deleted credentials for provider %s", provider_id)
            return True
        return False

    def has_credentials(self, provider_id: str) -> bool:
        """Check if credentials exist for a provider."""
        all_creds = self._load_all()
        return provider_id in all_creds
