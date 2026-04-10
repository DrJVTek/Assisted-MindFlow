"""TextOutputNode — terminal node that displays received text.

A sink node for displaying the final result of a chain, or inspecting
a mid-chain value for debugging. Takes a STRING input and (optionally)
passes it through so you can place it mid-chain without breaking the flow.
"""

from typing import Any, AsyncIterator

from mindflow.plugins.base import BaseNode


class TextOutputNode(BaseNode):
    """Terminal text display node.

    Receives text via its `text` input port (normally connected to the
    `response` output of an LLM node, or the `text` output of a text_input)
    and surfaces it as the node's content so it's visible on the canvas
    and in the DetailPanel.

    Design choices marked TODO below should match whatever sink-vs-passthrough
    and streaming behaviour the project prefers.
    """

    # TODO Décision 1 — Pass-through ou pur sink ?
    #
    # (a) Pur sink (terminal) :
    #         RETURN_TYPES = ()
    #         RETURN_NAMES = ()
    #     Le node n'a aucun port de sortie. Il se place en bout de chaîne,
    #     tu ne peux rien brancher derrière.
    #
    # (b) Pass-through :
    #         RETURN_TYPES = ("STRING",)
    #         RETURN_NAMES = ("text",)
    #     Le node a un port de sortie identique à son input. Tu peux le
    #     placer au milieu d'une chaîne pour inspecter une valeur sans
    #     casser le flow.
    #
    # Laisse l'option que tu veux active, commente l'autre.
    RETURN_TYPES: tuple[str, ...] = ()       # option (a) pur sink
    RETURN_NAMES: tuple[str, ...] = ()
    # RETURN_TYPES = ("STRING",)             # option (b) pass-through
    # RETURN_NAMES = ("text",)

    FUNCTION = "execute"
    CATEGORY = "output"

    # TODO Décision 2 — Supporte le streaming en direct ?
    #
    # Si STREAMING=True, l'orchestrator appelle `stream()` au lieu de
    # `execute()` quand text_output est le node terminal ciblé par le
    # bouton Generate. Les tokens arrivent un par un du node amont (qui
    # doit lui-même streamer, ex: LLMChatNode) et s'affichent live dans
    # la zone response du DetailPanel.
    #
    # Si STREAMING=False, l'orchestrator appelle `execute()` avec la
    # valeur batch finale, une seule fois, à la fin.
    STREAMING: bool = False  # passe à True si tu veux le live-stream

    UI = {
        "color": "#2E7D32",     # vert foncé, distinct du bleu text_input et du violet llm_chat
        "icon": "output",
        "min_height": 120,
    }

    @classmethod
    def INPUT_TYPES(cls) -> dict:
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    def execute(self, text: str = "", **kwargs: Any) -> tuple:
        """Display the received text.

        With option (a) (pure sink) the orchestrator still collects the
        return value and stores it in self._outputs[node_id], so downstream
        logic could read it even though the UI shows no output port. With
        option (b) (pass-through) the return value also flows to any
        connected child nodes.

        Returning a tuple keeps the execute contract uniform — the
        orchestrator already handles the `RETURN_TYPES = ()` case by
        producing an empty outputs dict.
        """
        # TODO (optionnel) : si tu veux que l'orchestrator persiste aussi
        # le texte reçu dans node.llm_response (pour l'affichage dans la
        # zone response du DetailPanel comme un LLM), l'orchestrator doit
        # être étendu OU on utilise un autre champ. Par défaut, le texte
        # arrive dans outputs et nodeResults[id].outputs.text côté frontend.
        return (text,) if self.RETURN_TYPES else ()

    async def stream(self, text: str = "", **kwargs: Any) -> AsyncIterator[str]:
        """Stream tokens through when used as a streaming terminal.

        Only called if STREAMING=True. Since text_output doesn't generate
        anything itself — it just displays what it receives — the stream
        implementation simply yields the upstream value in one chunk.
        The UI displays it in the response zone.

        To get TRUE token-by-token streaming from an upstream LLM, the
        orchestrator would need to pipe the source node's stream directly,
        which requires deeper changes (cross-node stream forwarding). For
        now this is a single-chunk stream.
        """
        if text:
            yield text
