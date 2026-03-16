"""Built-in data types for node connections.

Defines the type system used to validate connections between nodes.
Each type has a color (for frontend rendering) and a description.
Types marked as connection types can flow between nodes via edges.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DataType:
    """Definition of a data type for node connections."""
    name: str
    color: str
    description: str
    is_connection_type: bool = True


# Built-in types
BUILTIN_TYPES: dict[str, DataType] = {
    "STRING": DataType("STRING", "#8BC34A", "Text content"),
    "INT": DataType("INT", "#2196F3", "Integer number"),
    "FLOAT": DataType("FLOAT", "#FF9800", "Floating point number"),
    "BOOLEAN": DataType("BOOLEAN", "#9C27B0", "True/False value"),
    "COMBO": DataType("COMBO", "#607D8B", "Selection from options", is_connection_type=False),
    "SECRET": DataType("SECRET", "#F44336", "Encrypted credential", is_connection_type=False),
    "CONTEXT": DataType("CONTEXT", "#00BCD4", "Conversation context from parent nodes"),
    "USAGE": DataType("USAGE", "#795548", "Token usage information"),
    "TOOL_RESULT": DataType("TOOL_RESULT", "#E91E63", "MCP tool execution result"),
    "EMBEDDING": DataType("EMBEDDING", "#3F51B5", "Vector embedding"),
    "DOCUMENT": DataType("DOCUMENT", "#FF5722", "Structured document"),
}

# Implicit conversion rules: (source_type, target_type) -> allowed
# If a pair is not listed, the connection is rejected.
# Derived from data-model.md Type Compatibility Matrix.
IMPLICIT_CONVERSIONS: set[tuple[str, str]] = {
    # STRING conversions
    ("STRING", "CONTEXT"),   # Text can be wrapped as context
    # CONTEXT conversions
    ("CONTEXT", "STRING"),   # Context can be rendered as text
    # Numeric promotions
    ("INT", "STRING"),
    ("INT", "FLOAT"),        # Integer promotes to float
    ("INT", "BOOLEAN"),      # Non-zero → True, zero → False
    ("FLOAT", "STRING"),
    # Boolean conversions
    ("BOOLEAN", "STRING"),
    ("BOOLEAN", "INT"),      # True → 1, False → 0
    # Structured type to-STRING conversions
    ("USAGE", "STRING"),
    ("TOOL_RESULT", "STRING"),
    ("DOCUMENT", "STRING"),
    # NOTE: EMBEDDING→STRING is explicitly NOT allowed per data-model.md
}


def is_compatible(source_type: str, target_type: str) -> bool:
    """Check if a connection from source_type to target_type is valid.

    Rules:
    1. Same type is always compatible
    2. Implicit conversions are allowed (see IMPLICIT_CONVERSIONS)
    3. Non-connection types (COMBO, SECRET) cannot be connected
    4. All other combinations are rejected

    Args:
        source_type: The output type of the source node
        target_type: The input type of the target node

    Returns:
        True if the connection is valid, False otherwise
    """
    # Non-connection types cannot be wired
    src = BUILTIN_TYPES.get(source_type)
    tgt = BUILTIN_TYPES.get(target_type)
    if src and not src.is_connection_type:
        return False
    if tgt and not tgt.is_connection_type:
        return False

    # Same type is always compatible
    if source_type == target_type:
        return True

    # Check implicit conversions
    return (source_type, target_type) in IMPLICIT_CONVERSIONS


def get_type_definitions() -> dict[str, dict]:
    """Return all type definitions for the frontend discovery endpoint."""
    return {
        name: {
            "color": dt.color,
            "description": dt.description,
            "is_connection_type": dt.is_connection_type,
        }
        for name, dt in BUILTIN_TYPES.items()
    }
