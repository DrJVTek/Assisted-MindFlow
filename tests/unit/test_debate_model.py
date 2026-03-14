"""Unit tests for mindflow.models.debate module.

Tests DebateChain, DebateStatus, StartDebateRequest, and ContinueDebateRequest.
"""

import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from mindflow.models.debate import (
    ContinueDebateRequest,
    DebateChain,
    DebateStatus,
    StartDebateRequest,
)


# ── DebateStatus Enum ─────────────────────────────────────────


class TestDebateStatus:
    """Tests for the DebateStatus enum."""

    def test_enum_values(self):
        assert DebateStatus.PENDING == "pending"
        assert DebateStatus.RUNNING == "running"
        assert DebateStatus.COMPLETED == "completed"
        assert DebateStatus.STOPPED == "stopped"
        assert DebateStatus.ERROR == "error"

    def test_enum_member_count(self):
        assert len(DebateStatus) == 5


# ── DebateChain ───────────────────────────────────────────────


class TestDebateChain:
    """Tests for DebateChain model creation and methods."""

    def test_creation_with_defaults(self):
        graph_id = uuid4()
        start_node_id = uuid4()
        chain = DebateChain(graph_id=graph_id, start_node_id=start_node_id)

        assert chain.graph_id == graph_id
        assert chain.start_node_id == start_node_id
        assert chain.round_count == 0
        assert chain.max_rounds == 5
        assert chain.status == DebateStatus.PENDING
        assert chain.error_message is None
        assert chain.node_ids == []

    def test_uuid_auto_generation(self):
        chain1 = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        chain2 = DebateChain(graph_id=uuid4(), start_node_id=uuid4())

        assert isinstance(chain1.id, UUID)
        assert isinstance(chain2.id, UUID)
        assert chain1.id != chain2.id

    def test_timestamps_auto_generated(self):
        before = datetime.now(timezone.utc)
        chain = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        after = datetime.now(timezone.utc)

        assert before <= chain.created_at <= after
        assert before <= chain.updated_at <= after

    def test_is_terminal_pending(self):
        chain = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.PENDING,
        )
        assert chain.is_terminal() is False

    def test_is_terminal_running(self):
        chain = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.RUNNING,
        )
        assert chain.is_terminal() is False

    def test_is_terminal_completed(self):
        chain = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.COMPLETED,
        )
        assert chain.is_terminal() is True

    def test_is_terminal_stopped(self):
        chain = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.STOPPED,
        )
        assert chain.is_terminal() is True

    def test_is_terminal_error(self):
        chain = DebateChain(
            graph_id=uuid4(),
            start_node_id=uuid4(),
            status=DebateStatus.ERROR,
        )
        assert chain.is_terminal() is True

    def test_touch_updates_timestamp(self):
        chain = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        original_updated_at = chain.updated_at

        # Small delay to ensure timestamp differs
        time.sleep(0.01)
        chain.touch()

        assert chain.updated_at > original_updated_at

    def test_touch_does_not_change_created_at(self):
        chain = DebateChain(graph_id=uuid4(), start_node_id=uuid4())
        original_created_at = chain.created_at

        time.sleep(0.01)
        chain.touch()

        assert chain.created_at == original_created_at

    def test_creation_with_explicit_values(self):
        graph_id = uuid4()
        start_node_id = uuid4()
        node_ids = [uuid4(), uuid4()]

        chain = DebateChain(
            graph_id=graph_id,
            start_node_id=start_node_id,
            node_ids=node_ids,
            round_count=3,
            max_rounds=10,
            status=DebateStatus.RUNNING,
            error_message="test error",
        )

        assert chain.round_count == 3
        assert chain.max_rounds == 10
        assert chain.status == DebateStatus.RUNNING
        assert chain.error_message == "test error"
        assert chain.node_ids == node_ids


# ── StartDebateRequest ────────────────────────────────────────


class TestStartDebateRequest:
    """Tests for StartDebateRequest validation."""

    def test_valid_request(self):
        graph_id = uuid4()
        start_node_id = uuid4()
        req = StartDebateRequest(
            graph_id=graph_id,
            start_node_id=start_node_id,
            max_rounds=10,
        )
        assert req.graph_id == graph_id
        assert req.start_node_id == start_node_id
        assert req.max_rounds == 10

    def test_default_max_rounds(self):
        req = StartDebateRequest(graph_id=uuid4(), start_node_id=uuid4())
        assert req.max_rounds == 5

    def test_max_rounds_minimum_1(self):
        req = StartDebateRequest(
            graph_id=uuid4(), start_node_id=uuid4(), max_rounds=1
        )
        assert req.max_rounds == 1

    def test_max_rounds_maximum_50(self):
        req = StartDebateRequest(
            graph_id=uuid4(), start_node_id=uuid4(), max_rounds=50
        )
        assert req.max_rounds == 50

    def test_max_rounds_below_minimum_raises(self):
        with pytest.raises(ValidationError):
            StartDebateRequest(
                graph_id=uuid4(), start_node_id=uuid4(), max_rounds=0
            )

    def test_max_rounds_above_maximum_raises(self):
        with pytest.raises(ValidationError):
            StartDebateRequest(
                graph_id=uuid4(), start_node_id=uuid4(), max_rounds=51
            )

    def test_negative_max_rounds_raises(self):
        with pytest.raises(ValidationError):
            StartDebateRequest(
                graph_id=uuid4(), start_node_id=uuid4(), max_rounds=-1
            )


# ── ContinueDebateRequest ────────────────────────────────────


class TestContinueDebateRequest:
    """Tests for ContinueDebateRequest validation."""

    def test_valid_request(self):
        req = ContinueDebateRequest(additional_rounds=5)
        assert req.additional_rounds == 5

    def test_default_additional_rounds(self):
        req = ContinueDebateRequest()
        assert req.additional_rounds == 1

    def test_additional_rounds_minimum_1(self):
        req = ContinueDebateRequest(additional_rounds=1)
        assert req.additional_rounds == 1

    def test_additional_rounds_maximum_50(self):
        req = ContinueDebateRequest(additional_rounds=50)
        assert req.additional_rounds == 50

    def test_additional_rounds_below_minimum_raises(self):
        with pytest.raises(ValidationError):
            ContinueDebateRequest(additional_rounds=0)

    def test_additional_rounds_above_maximum_raises(self):
        with pytest.raises(ValidationError):
            ContinueDebateRequest(additional_rounds=51)
