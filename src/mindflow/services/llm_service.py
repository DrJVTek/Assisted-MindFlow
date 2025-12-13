"""LLM service for node content generation.

This module provides the interface for generating node content using LLM providers.
"""

import logging
import os
from typing import List, Optional, Dict, Any
from uuid import UUID

from mindflow.models.node import Node, NodeType
from mindflow.providers.openai import OpenAIProvider
from mindflow.providers.anthropic import AnthropicProvider
from mindflow.providers.ollama import OllamaProvider
from mindflow.providers.base import LLMProvider

logger = logging.getLogger(__name__)


class LLMService:
    """Service for generating node content using LLM."""

    def __init__(self, provider: str = "openai", model: str = "gpt-4"):
        """Initialize LLM service.

        Args:
            provider: LLM provider name ("openai", "anthropic", "ollama")
            model: Model name/ID to use
        """
        self.provider_name = provider
        self.model = model
        self.provider = self._get_provider(provider)

    def _get_provider(self, provider_name: str) -> LLMProvider:
        """Get provider instance based on name."""
        if provider_name == "openai":
            return OpenAIProvider()
        elif provider_name == "anthropic":
            return AnthropicProvider()
        elif provider_name == "ollama":
            return OllamaProvider()
        else:
            raise ValueError(f"Unsupported provider: {provider_name}")

    async def generate_node_content(
        self,
        node_type: NodeType,
        parent_nodes: List[Node],
        previous_content: Optional[str] = None,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Generate content for a node based on its parents.

        Args:
            node_type: Type of node to generate content for
            parent_nodes: List of parent nodes to use as context
            previous_content: Previous content of the node (for reference)
            system_prompt: Optional system instructions
            metadata: Optional generation parameters

        Returns:
            Generated content string
        """
        # Build context from parents
        context_parts = []
        for i, parent in enumerate(parent_nodes, 1):
            context_parts.append(f"Parent Node {i} ({parent.type}):\n{parent.content}\n")
        
        context_text = "\n".join(context_parts)
        
        # Construct prompt based on node type
        prompt = self._construct_prompt(node_type, context_text, previous_content)
        
        try:
            return await self.provider.generate(
                prompt=prompt,
                model=self.model,
                system_prompt=system_prompt,
                metadata=metadata
            )
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise

    def _construct_prompt(
        self, 
        node_type: NodeType, 
        context: str, 
        previous: Optional[str]
    ) -> str:
        """Construct prompt for the LLM."""
        base_prompt = f"Context:\n{context}\n\n"
        
        if previous:
            base_prompt += f"Previous Content:\n{previous}\n\n"

        if node_type == "question":
            return base_prompt + "Generate a follow-up question based on the context."
        elif node_type == "answer":
            return base_prompt + "Provide a comprehensive answer based on the context."
        elif node_type == "hypothesis":
            return base_prompt + "Formulate a hypothesis based on the context."
        elif node_type == "evaluation":
            return base_prompt + "Evaluate the ideas in the context."
        elif node_type == "summary":
            return base_prompt + "Summarize the key points from the context."
        else:
            return base_prompt + f"Generate content for a {node_type} node based on the context."
