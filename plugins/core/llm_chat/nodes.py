"""LLMChatNode — LLM chat node with dual-zone prompt/response.

Replaces old "question"/"answer" node types. Takes a prompt (user text)
and optional context from parent nodes, generates a response via an
LLM provider, and outputs both the response and the full conversation
context.
"""

from typing import Any, AsyncIterator

from mindflow.plugins.base import LLMNode


class LLMChatNode(LLMNode):
    """LLM chat node with prompt input and streaming response.

    Dual-zone behavior:
    - Top zone: prompt (user-editable)
    - Bottom zone: LLM response (streamed, read-only during generation)

    The provider instance is injected by the execution engine at runtime
    based on the provider_id selected by the user.
    """

    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm"
    STREAMING = True
    UI = {
        "color": "#7C3AED",
        "icon": "message-square",
        "min_height": 200,
        "dual_zone": True,
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                # Only `model` is strictly required — the prompt is
                # normally typed directly into the node in the DetailPanel
                # (stored as node.content, which the orchestrator maps to
                # inputs["prompt"]). Keeping `prompt` as an OPTIONAL input
                # port lets advanced users override the typed content by
                # wiring in a string from elsewhere, without forcing them
                # to do so.
                "model": ("COMBO", {"options": []}),
            },
            "optional": {
                "prompt": ("STRING", {"multiline": True}),
                "context": ("CONTEXT", {}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.1}),
                "max_tokens": ("INT", {"default": 1024, "min": 1, "max": 128000}),
            },
            "credentials": {
                "provider_id": ("SECRET", {"label": "LLM Provider"}),
            },
        }

    async def execute(
        self,
        model: str,
        prompt: str = "",
        provider: Any = None,
        context: str = "",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> tuple[str, str]:
        """Generate a complete response (batch mode).

        Args:
            prompt: User prompt
            model: Model identifier
            provider: LLM provider instance (injected by engine)
            context: Optional context from parent nodes
            system_prompt: Optional system instructions
            temperature: Sampling temperature
            max_tokens: Maximum response tokens

        Returns:
            Tuple of (response_text, updated_context)
        """
        if provider is None:
            raise ValueError("LLMChatNode requires a provider instance. Select a provider in node settings.")

        full_prompt = prompt
        if context:
            full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}"

        response = await provider.generate(
            prompt=full_prompt,
            model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Build updated context for downstream nodes
        updated_context = context
        if updated_context:
            updated_context += "\n\n"
        updated_context += f"User: {prompt}\nAssistant: {response.content}"

        return (response.content, updated_context, prompt)

    async def stream(
        self,
        model: str,
        prompt: str = "",
        provider: Any = None,
        context: str = "",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response tokens.

        Args:
            prompt: User prompt
            model: Model identifier
            provider: LLM provider instance (injected by engine)
            context: Optional context from parent nodes
            system_prompt: Optional system instructions
            temperature: Sampling temperature
            max_tokens: Maximum response tokens

        Yields:
            Response tokens as they are generated
        """
        if provider is None:
            raise ValueError("LLMChatNode requires a provider instance. Select a provider in node settings.")

        full_prompt = prompt
        if context:
            full_prompt = f"Context:\n{context}\n\nUser:\n{prompt}"

        async for token in provider.stream(
            prompt=full_prompt,
            model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield token
