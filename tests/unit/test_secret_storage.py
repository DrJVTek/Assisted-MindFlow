"""Unit tests for SecretStorage service."""

import pytest
from pathlib import Path
from uuid import uuid4

from mindflow.models.provider import ProviderCredentials
from mindflow.services.secret_storage import SecretStorage


@pytest.fixture
def tmp_secrets_dir(tmp_path):
    """Create a temporary secrets directory."""
    secrets_dir = tmp_path / "secrets"
    secrets_dir.mkdir()
    return secrets_dir


@pytest.fixture
def storage(tmp_secrets_dir):
    """Create a SecretStorage instance with temp directory."""
    return SecretStorage(secrets_dir=tmp_secrets_dir)


class TestSecretStorage:
    """Tests for encrypted credential storage."""

    def test_key_generation_on_first_use(self, storage, tmp_secrets_dir):
        """Key file should be auto-generated on first use."""
        pid = uuid4()
        creds = ProviderCredentials(provider_id=pid, api_key="sk-test-123")
        storage.save_credentials(creds)

        key_file = tmp_secrets_dir / ".key"
        assert key_file.exists()
        assert len(key_file.read_bytes()) > 0

    def test_save_and_retrieve_credentials(self, storage):
        """Should encrypt and decrypt credentials correctly."""
        pid = uuid4()
        creds = ProviderCredentials(
            provider_id=pid,
            api_key="sk-test-secret-key",
            oauth_token="oauth-token-123",
        )
        storage.save_credentials(creds)

        loaded = storage.get_credentials(str(pid))
        assert loaded is not None
        assert loaded.api_key == "sk-test-secret-key"
        assert loaded.oauth_token == "oauth-token-123"
        assert loaded.provider_id == pid

    def test_get_nonexistent_credentials(self, storage):
        """Should return None for unknown provider ID."""
        result = storage.get_credentials("nonexistent-id")
        assert result is None

    def test_delete_credentials(self, storage):
        """Should remove credentials for a provider."""
        pid = uuid4()
        creds = ProviderCredentials(provider_id=pid, api_key="sk-delete-me")
        storage.save_credentials(creds)

        assert storage.has_credentials(str(pid))
        assert storage.delete_credentials(str(pid))
        assert not storage.has_credentials(str(pid))
        assert storage.get_credentials(str(pid)) is None

    def test_delete_nonexistent(self, storage):
        """Should return False when deleting nonexistent credentials."""
        assert not storage.delete_credentials("no-such-id")

    def test_multiple_providers(self, storage):
        """Should handle credentials for multiple providers."""
        pid1, pid2 = uuid4(), uuid4()
        storage.save_credentials(ProviderCredentials(provider_id=pid1, api_key="key-1"))
        storage.save_credentials(ProviderCredentials(provider_id=pid2, api_key="key-2"))

        loaded1 = storage.get_credentials(str(pid1))
        loaded2 = storage.get_credentials(str(pid2))
        assert loaded1.api_key == "key-1"
        assert loaded2.api_key == "key-2"

    def test_update_existing_credentials(self, storage):
        """Should overwrite credentials for same provider ID."""
        pid = uuid4()
        storage.save_credentials(ProviderCredentials(provider_id=pid, api_key="old-key"))
        storage.save_credentials(ProviderCredentials(provider_id=pid, api_key="new-key"))

        loaded = storage.get_credentials(str(pid))
        assert loaded.api_key == "new-key"

    def test_encrypted_file_not_plaintext(self, storage, tmp_secrets_dir):
        """Credentials file should not contain plaintext API keys."""
        pid = uuid4()
        storage.save_credentials(
            ProviderCredentials(provider_id=pid, api_key="sk-super-secret-value")
        )

        enc_file = tmp_secrets_dir / "providers.enc"
        assert enc_file.exists()
        contents = enc_file.read_bytes()
        assert b"sk-super-secret-value" not in contents

    def test_persistence_across_instances(self, tmp_secrets_dir):
        """Credentials should survive creating a new SecretStorage instance."""
        pid = uuid4()
        storage1 = SecretStorage(secrets_dir=tmp_secrets_dir)
        storage1.save_credentials(ProviderCredentials(provider_id=pid, api_key="persistent-key"))

        storage2 = SecretStorage(secrets_dir=tmp_secrets_dir)
        loaded = storage2.get_credentials(str(pid))
        assert loaded is not None
        assert loaded.api_key == "persistent-key"

    def test_has_credentials(self, storage):
        """Should check existence correctly."""
        pid = uuid4()
        assert not storage.has_credentials(str(pid))
        storage.save_credentials(ProviderCredentials(provider_id=pid, api_key="key"))
        assert storage.has_credentials(str(pid))
