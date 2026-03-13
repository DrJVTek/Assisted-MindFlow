"""Unit tests for encrypted token storage service."""

import json
import pytest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

from mindflow.models.oauth_session import OAuthSession
from mindflow.services.token_storage import TokenStorage


@pytest.fixture
def tmp_storage(tmp_path: Path) -> TokenStorage:
    """Create a TokenStorage with temp paths."""
    return TokenStorage(
        session_path=tmp_path / "session.enc",
        salt_path=tmp_path / ".salt",
    )


@pytest.fixture
def sample_session() -> OAuthSession:
    """Create a sample OAuth session for testing."""
    return OAuthSession(
        access_token="test_access_token_abc123",
        refresh_token="test_refresh_token_xyz789",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        token_type="Bearer",
        subscription_tier="plus",
        user_email="test@example.com",
    )


class TestTokenStorageRoundTrip:
    """Test encrypt/decrypt round-trip."""

    def test_save_and_load_session(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        loaded = tmp_storage.load_session()

        assert loaded is not None
        assert loaded.access_token == sample_session.access_token
        assert loaded.refresh_token == sample_session.refresh_token
        assert loaded.subscription_tier == sample_session.subscription_tier
        assert loaded.user_email == sample_session.user_email
        assert loaded.token_type == "Bearer"

    def test_round_trip_preserves_all_fields(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        loaded = tmp_storage.load_session()

        assert loaded is not None
        original = sample_session.to_storage_dict()
        restored = loaded.to_storage_dict()
        assert original == restored


class TestSaltGeneration:
    """Test salt file generation."""

    def test_salt_created_on_first_save(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        salt_path = tmp_storage._salt_path
        assert not salt_path.exists()

        tmp_storage.save_session(sample_session)
        assert salt_path.exists()
        assert len(salt_path.read_bytes()) == 32

    def test_salt_reused_on_subsequent_saves(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        salt1 = tmp_storage._salt_path.read_bytes()

        tmp_storage.save_session(sample_session)
        salt2 = tmp_storage._salt_path.read_bytes()

        assert salt1 == salt2


class TestMissingFile:
    """Test missing file handling."""

    def test_load_returns_none_when_no_session(self, tmp_storage: TokenStorage):
        assert tmp_storage.load_session() is None

    def test_has_session_false_when_no_file(self, tmp_storage: TokenStorage):
        assert tmp_storage.has_session() is False

    def test_has_session_true_after_save(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        assert tmp_storage.has_session() is True

    def test_delete_returns_false_when_no_file(self, tmp_storage: TokenStorage):
        assert tmp_storage.delete_session() is False


class TestCorruptedFile:
    """Test corrupted file handling."""

    def test_load_returns_none_for_garbage_data(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        tmp_storage._session_path.write_bytes(b"not-encrypted-data")

        assert tmp_storage.load_session() is None

    def test_load_returns_none_for_wrong_key(self, tmp_path: Path, sample_session: OAuthSession):
        storage1 = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt1",
        )
        storage1.save_session(sample_session)

        storage2 = TokenStorage(
            session_path=tmp_path / "session.enc",
            salt_path=tmp_path / ".salt2",
        )
        assert storage2.load_session() is None

    def test_load_returns_none_for_invalid_json(self, tmp_storage: TokenStorage):
        from cryptography.fernet import Fernet
        fernet = tmp_storage._get_fernet()
        encrypted = fernet.encrypt(b"not-valid-json")
        tmp_storage._session_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_storage._session_path.write_bytes(encrypted)

        assert tmp_storage.load_session() is None


class TestDeleteSession:
    """Test session deletion."""

    def test_delete_removes_file(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        assert tmp_storage._session_path.exists()

        result = tmp_storage.delete_session()
        assert result is True
        assert not tmp_storage._session_path.exists()

    def test_load_after_delete_returns_none(self, tmp_storage: TokenStorage, sample_session: OAuthSession):
        tmp_storage.save_session(sample_session)
        tmp_storage.delete_session()
        assert tmp_storage.load_session() is None
