"""Tests: type compatibility validation for node connections."""

import pytest

from mindflow.plugins.types import (
    is_compatible,
    get_type_definitions,
    BUILTIN_TYPES,
    IMPLICIT_CONVERSIONS,
)


class TestSameTypeCompatibility:
    """Same type is always compatible."""

    @pytest.mark.parametrize("type_name", [
        "STRING", "INT", "FLOAT", "BOOLEAN", "CONTEXT",
        "USAGE", "TOOL_RESULT", "EMBEDDING", "DOCUMENT",
    ])
    def test_same_type_always_compatible(self, type_name):
        assert is_compatible(type_name, type_name) is True


class TestImplicitConversions:
    """Allowed implicit conversions per data-model.md matrix."""

    def test_string_to_context_allowed(self):
        """STRING can be wrapped as CONTEXT."""
        assert is_compatible("STRING", "CONTEXT") is True

    def test_context_to_string_allowed(self):
        """CONTEXT can be rendered as STRING."""
        assert is_compatible("CONTEXT", "STRING") is True

    @pytest.mark.parametrize("source", [
        "INT", "FLOAT", "BOOLEAN", "CONTEXT",
        "USAGE", "TOOL_RESULT", "DOCUMENT",
    ])
    def test_to_string_allowed(self, source):
        """These types can be converted to STRING."""
        assert is_compatible(source, "STRING") is True

    def test_int_to_float_allowed(self):
        """INT promotes to FLOAT."""
        assert is_compatible("INT", "FLOAT") is True

    def test_int_to_boolean_allowed(self):
        """INT converts to BOOLEAN (non-zero → True)."""
        assert is_compatible("INT", "BOOLEAN") is True

    def test_boolean_to_int_allowed(self):
        """BOOLEAN converts to INT (True → 1, False → 0)."""
        assert is_compatible("BOOLEAN", "INT") is True


class TestRejectedConnections:
    """Incompatible connections must be rejected per data-model.md matrix."""

    def test_embedding_to_string_rejected(self):
        """EMBEDDING → STRING is NOT allowed per data-model.md."""
        assert is_compatible("EMBEDDING", "STRING") is False

    def test_string_to_embedding_rejected(self):
        """STRING → EMBEDDING is NOT allowed."""
        assert is_compatible("STRING", "EMBEDDING") is False

    def test_int_to_context_rejected(self):
        """INT → CONTEXT is NOT allowed."""
        assert is_compatible("INT", "CONTEXT") is False

    def test_float_to_boolean_rejected(self):
        """FLOAT → BOOLEAN is NOT allowed."""
        assert is_compatible("FLOAT", "BOOLEAN") is False

    def test_float_to_int_rejected(self):
        """FLOAT → INT is NOT allowed (lossy conversion)."""
        assert is_compatible("FLOAT", "INT") is False

    def test_context_to_embedding_rejected(self):
        """CONTEXT → EMBEDDING is NOT allowed."""
        assert is_compatible("CONTEXT", "EMBEDDING") is False

    def test_usage_to_tool_result_rejected(self):
        """USAGE → TOOL_RESULT is NOT allowed."""
        assert is_compatible("USAGE", "TOOL_RESULT") is False

    def test_document_to_embedding_rejected(self):
        """DOCUMENT → EMBEDDING is NOT allowed."""
        assert is_compatible("DOCUMENT", "EMBEDDING") is False

    def test_embedding_to_context_rejected(self):
        """EMBEDDING → CONTEXT is NOT allowed."""
        assert is_compatible("EMBEDDING", "CONTEXT") is False


class TestNonConnectionTypes:
    """COMBO and SECRET cannot be connected."""

    def test_combo_as_source_rejected(self):
        """COMBO cannot be a connection source."""
        assert is_compatible("COMBO", "STRING") is False

    def test_combo_as_target_rejected(self):
        """COMBO cannot be a connection target."""
        assert is_compatible("STRING", "COMBO") is False

    def test_secret_as_source_rejected(self):
        """SECRET cannot be a connection source."""
        assert is_compatible("SECRET", "STRING") is False

    def test_secret_as_target_rejected(self):
        """SECRET cannot be a connection target."""
        assert is_compatible("STRING", "SECRET") is False

    def test_combo_to_combo_rejected(self):
        """Even same-type COMBO cannot connect (not a connection type)."""
        assert is_compatible("COMBO", "COMBO") is False

    def test_secret_to_secret_rejected(self):
        """Even same-type SECRET cannot connect."""
        assert is_compatible("SECRET", "SECRET") is False


class TestUnknownTypes:
    """Unknown types are handled gracefully."""

    def test_unknown_source_same_as_target_compatible(self):
        """Unknown types match themselves (plugin-defined custom types)."""
        assert is_compatible("CUSTOM_AUDIO", "CUSTOM_AUDIO") is True

    def test_unknown_to_known_rejected(self):
        """Unknown type to known type with no conversion is rejected."""
        assert is_compatible("CUSTOM_AUDIO", "STRING") is False

    def test_known_to_unknown_rejected(self):
        """Known type to unknown type with no conversion is rejected."""
        assert is_compatible("STRING", "CUSTOM_AUDIO") is False


class TestTypeDefinitions:
    """get_type_definitions() returns correct metadata."""

    def test_returns_all_builtin_types(self):
        defs = get_type_definitions()
        assert set(defs.keys()) == set(BUILTIN_TYPES.keys())

    def test_each_type_has_required_fields(self):
        defs = get_type_definitions()
        for name, info in defs.items():
            assert "color" in info, f"{name} missing color"
            assert "description" in info, f"{name} missing description"
            assert "is_connection_type" in info, f"{name} missing is_connection_type"

    def test_combo_not_connection_type(self):
        defs = get_type_definitions()
        assert defs["COMBO"]["is_connection_type"] is False

    def test_secret_not_connection_type(self):
        defs = get_type_definitions()
        assert defs["SECRET"]["is_connection_type"] is False

    def test_string_is_connection_type(self):
        defs = get_type_definitions()
        assert defs["STRING"]["is_connection_type"] is True
