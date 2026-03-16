"""Plugin node base classes.

Defines the base interfaces for all plugin node types following
a ComfyUI-inspired pattern with INPUT_TYPES, RETURN_TYPES, and
self-describing class attributes.

Two base classes:
- BaseNode: For all node types (text input, transform, output, etc.)
- LLMNode: Extension for LLM-category nodes that consume a provider instance
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator


class BaseNode(ABC):
    """Abstract base class for all plugin node types.

    Each node type must define class-level attributes describing its
    inputs, outputs, execution function, category, and optional UI hints.

    Class Attributes:
        RETURN_TYPES: Tuple of output data type names (e.g., ("STRING",))
        RETURN_NAMES: Tuple of output port names (e.g., ("text",))
        FUNCTION: Name of the instance method to call for execution
        CATEGORY: Category path for UI grouping (e.g., "llm/openai", "input")
        STREAMING: Whether this node supports streaming output (default: False)
        UI: Dict of frontend hints (color, icon, width, min_height)

    Required classmethod:
        INPUT_TYPES(): Returns dict with "required", "optional", and
                       optionally "credentials" sections.
    """

    RETURN_TYPES: tuple[str, ...] = ()
    RETURN_NAMES: tuple[str, ...] = ()
    FUNCTION: str = "execute"
    CATEGORY: str = "uncategorized"
    STREAMING: bool = False
    UI: dict[str, Any] = {}

    @classmethod
    @abstractmethod
    def INPUT_TYPES(cls) -> dict[str, dict[str, tuple]]:
        """Define node inputs.

        Returns:
            Dict with keys:
            - "required": {name: (TYPE, {options})} — must be provided
            - "optional": {name: (TYPE, {options})} — can be omitted
            - "credentials": {name: ("SECRET", {options})} — injected by system

        Example:
            {
                "required": {
                    "prompt": ("STRING", {"multiline": True}),
                    "model": ("COMBO", {"options": ["gpt-4o"]}),
                },
                "optional": {
                    "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0}),
                },
            }
        """
        ...

    def validate_inputs(self, **kwargs: Any) -> None:
        """Validate inputs before execution. Override for custom validation.

        Raises:
            ValueError: If inputs are invalid.
        """
        input_types = self.INPUT_TYPES()
        required = input_types.get("required", {})
        for name in required:
            if name not in kwargs or kwargs[name] is None:
                raise ValueError(
                    f"Missing required input '{name}' for node type "
                    f"'{self.__class__.__name__}'"
                )


class LLMNode(BaseNode):
    """Base class for LLM-category node plugins.

    Extends BaseNode with streaming support and a reference to
    an LLM provider instance. LLM nodes do not implement LLM logic
    directly — they delegate to a provider instance passed at execution.

    The provider is injected by the execution engine based on the
    node's provider_id configuration.
    """

    STREAMING: bool = True

    @abstractmethod
    async def stream(self, **kwargs: Any) -> AsyncIterator[str]:
        """Stream output tokens.

        The provider instance is passed as a kwarg by the execution engine.

        Yields:
            Tokens as they are generated.
        """
        ...
