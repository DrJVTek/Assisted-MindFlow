"""ChatGPT Web node — LLM node using ChatGPT OAuth subscription.

Unlike API-based providers, this node supports importing conversations
and projects from the user's ChatGPT account via the import system.
"""

from typing import Any, AsyncIterator

from mindflow.plugins.base import LLMNode


class ChatGPTWebNode(LLMNode):
    """Chat node using ChatGPT Web (OAuth subscription).

    Uses the ChatGPT backend Responses API (same as Codex CLI).
    Supports conversation/project import from the user's ChatGPT account.
    """

    RETURN_TYPES = ("STRING", "CONTEXT", "STRING")
    RETURN_NAMES = ("response", "context", "prompt")
    FUNCTION = "execute"
    CATEGORY = "llm/chatgpt_web"
    STREAMING = True
    UI = {
        "color": "#74AA9C",
        "icon": "chatgpt",
        "min_height": 200,
        "dual_zone": True,
        "supports_import": True,
        "import_types": ["conversations", "projects"],
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True}),
                "model": ("COMBO", {"options": [
                    "gpt-5.1-codex", "gpt-5.1-codex-mini", "gpt-5.1-codex-max",
                    "gpt-5.2-codex", "gpt-5.1", "gpt-5.2",
                    "codex-mini-latest",
                ]}),
            },
            "optional": {
                "context": ("CONTEXT", {}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "imported_messages": ("STRING", {
                    "multiline": True, "default": "",
                    "label": "Imported Messages",
                    "description": "Messages imported from ChatGPT conversations/projects",
                }),
            },
            "credentials": {
                "provider_id": ("SECRET", {"label": "ChatGPT OAuth Session"}),
            },
        }

    async def execute(self, prompt: str, model: str, provider: Any = None,
                      context: str = "", system_prompt: str = "",
                      imported_messages: str = "",
                      **kwargs: Any) -> tuple[str, str]:
        if provider is None:
            raise ValueError("ChatGPTWebNode requires a ChatGPT provider instance. Sign in via Settings.")

        # Merge imported messages into context if present
        full_context = context
        if imported_messages:
            full_context = (full_context + "\n\n" if full_context else "") + f"Imported:\n{imported_messages}"

        full_prompt = f"Context:\n{full_context}\n\nUser:\n{prompt}" if full_context else prompt
        response = await provider.generate(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
        )
        updated_context = (full_context + "\n\n" if full_context else "") + f"User: {prompt}\nAssistant: {response.content}"
        return (response.content, updated_context, prompt)

    async def stream(self, prompt: str, model: str, provider: Any = None,
                     context: str = "", system_prompt: str = "",
                     imported_messages: str = "",
                     **kwargs: Any) -> AsyncIterator[str]:
        if provider is None:
            raise ValueError("ChatGPTWebNode requires a ChatGPT provider instance. Sign in via Settings.")

        full_context = context
        if imported_messages:
            full_context = (full_context + "\n\n" if full_context else "") + f"Imported:\n{imported_messages}"

        full_prompt = f"Context:\n{full_context}\n\nUser:\n{prompt}" if full_context else prompt
        async for token in provider.stream(
            prompt=full_prompt, model=model,
            system_prompt=system_prompt or None,
        ):
            yield token
