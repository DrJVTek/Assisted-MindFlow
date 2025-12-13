"""Base LLM provider interface.

Defines the contract that all LLM providers must implement.
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, Any, Optional

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Generate a complete response.
        
        Args:
            prompt: The user prompt
            model: The model identifier to use
            system_prompt: Optional system instructions
            metadata: Optional provider-specific metadata
            
        Returns:
            The complete generated text
        """
        pass

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> AsyncIterator[str]:
        """Stream the response token by token.
        
        Args:
            prompt: The user prompt
            model: The model identifier to use
            system_prompt: Optional system instructions
            metadata: Optional provider-specific metadata
            
        Yields:
            Tokens as they are generated
        """
        pass
