"""LLMChatNode — LLM chat node with dual-zone prompt/response.

Replaces old "question"/"answer" node types. Takes a prompt (user text)
and optional context from parent nodes, generates a response via an
LLM provider, and outputs both the response and the full conversation
context.

Input ports:
  - prompt  (optional): the user's typed text, normally filled from
                        node.content in the DetailPanel. Wireable to
                        override the typed content entirely.
  - input   (optional): a separate value feed — use `{input}` inside
                        your prompt text to embed the upstream value
                        at a precise location. Without the placeholder
                        the input is ignored (not appended).
  - context (optional): CONTEXT type, the accumulated conversation
                        history from an upstream chat node. Prepended
                        as "Context:\\n..." before the prompt.
"""

from typing import Any, AsyncIterator

from mindflow.plugins.base import LLMNode


def _substitute_input(prompt_text: str, input_value: str) -> str:
    """Replace `{input}` placeholders in the prompt with the upstream value.

    Uses a plain literal replace (not str.format) so stray braces in the
    prompt don't cause KeyError, and so this substitution doesn't conflict
    with the orchestrator-level `{{var}}` template system used elsewhere.
    """
    if not input_value:
        return prompt_text
    return prompt_text.replace("{input}", input_value)


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
                # `input` is a separate value feed. Connect an upstream
                # node's output to this port, then reference it as
                # `{input}` inside your prompt text. Unlike `prompt`
                # (which REPLACES the typed content when wired), `input`
                # INJECTS the upstream value wherever `{input}` appears.
                "input": ("STRING", {"multiline": True, "default": ""}),
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
        input: str = "",
        provider: Any = None,
        context: str = "",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> tuple[str, str]:
        """Generate a complete response (batch mode).

        Args:
            model: Model identifier
            prompt: User prompt (typed content from node.content, or
                wired override)
            input: Separate upstream value. If the prompt contains
                `{input}`, that placeholder is replaced with this value.
                Otherwise the value is ignored.
            provider: LLM provider instance (injected by engine)
            context: Optional conversation history from parent nodes
            system_prompt: Optional system instructions
            temperature: Sampling temperature
            max_tokens: Maximum response tokens

        Returns:
            Tuple of (response_text, updated_context, original_prompt)
        """
        if provider is None:
            raise ValueError("LLMChatNode requires a provider instance. Select a provider in node settings.")

        resolved_prompt = _substitute_input(prompt, input)

        full_prompt = resolved_prompt
        if context:
            full_prompt = f"Context:\n{context}\n\nUser:\n{resolved_prompt}"

        response = await provider.generate(
            prompt=full_prompt,
            model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # Build updated context for downstream nodes using the RESOLVED
        # prompt (what the user actually said after substitution), so
        # chat history shows the real conversation.
        updated_context = context
        if updated_context:
            updated_context += "\n\n"
        updated_context += f"User: {resolved_prompt}\nAssistant: {response.content}"

        return (response.content, updated_context, resolved_prompt)

    async def stream(
        self,
        model: str,
        prompt: str = "",
        input: str = "",
        provider: Any = None,
        context: str = "",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Stream response tokens.

        Same args as execute(). The `{input}` substitution happens before
        the provider is called so the streamed tokens reflect the
        fully-resolved prompt.
        """
        if provider is None:
            raise ValueError("LLMChatNode requires a provider instance. Select a provider in node settings.")

        resolved_prompt = _substitute_input(prompt, input)

        full_prompt = resolved_prompt
        if context:
            full_prompt = f"Context:\n{context}\n\nUser:\n{resolved_prompt}"

        async for token in provider.stream(
            prompt=full_prompt,
            model=model,
            system_prompt=system_prompt or None,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield token
