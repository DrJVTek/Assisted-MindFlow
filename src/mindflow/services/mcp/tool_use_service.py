"""Tool-Use Service (Feature 011 - US5).

Bridges MCP tools with LLM providers. Handles:
- Converting MCP tool schemas to provider-specific formats (OpenAI functions, Claude tools, Gemini function_declarations)
- Executing tool calls via MCP client manager
- Multi-turn tool-use loop: LLM → tool call → execute → feed result → LLM continues
"""

import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

logger = logging.getLogger(__name__)

# Maximum tool-use iterations to prevent infinite loops
MAX_TOOL_ITERATIONS = 10


def mcp_tools_to_openai(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to OpenAI function-calling format.

    MCP tool schema: {name, description, input_schema: {type: "object", properties: {...}, required: [...]}}
    OpenAI format: {type: "function", function: {name, description, parameters: {...}}}
    """
    openai_tools = []
    for tool in tools:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool.get("input_schema", {"type": "object", "properties": {}}),
            },
        })
    return openai_tools


def mcp_tools_to_anthropic(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to Anthropic/Claude tool format.

    Claude format: {name, description, input_schema: {type: "object", properties: {...}, required: [...]}}
    MCP format is already very close to Claude's native format.
    """
    claude_tools = []
    for tool in tools:
        claude_tools.append({
            "name": tool["name"],
            "description": tool.get("description", ""),
            "input_schema": tool.get("input_schema", {"type": "object", "properties": {}}),
        })
    return claude_tools


def mcp_tools_to_gemini(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to Gemini function_declarations format.

    Gemini format: {function_declarations: [{name, description, parameters: {type, properties, required}}]}
    """
    declarations = []
    for tool in tools:
        schema = tool.get("input_schema", {"type": "object", "properties": {}})
        declarations.append({
            "name": tool["name"],
            "description": tool.get("description", ""),
            "parameters": schema,
        })
    return declarations


async def generate_with_tools(
    provider_name: str,
    provider_instance: Any,
    prompt: str,
    model: str,
    mcp_tools: List[Dict[str, Any]],
    tool_executor,
    system_prompt: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate LLM response with tool-use support.

    Runs a multi-turn loop:
    1. Send prompt + tool definitions to LLM
    2. If LLM returns tool calls, execute them via tool_executor
    3. Feed tool results back to LLM
    4. Repeat until LLM returns a text response (or max iterations)

    Args:
        provider_name: Provider type (openai, anthropic, gemini, ollama)
        provider_instance: The initialized provider
        prompt: User prompt
        model: Model ID
        mcp_tools: List of MCP tool schemas (from MCPClientManager.get_all_tools())
        tool_executor: Async callable(connection_id, tool_name, arguments) -> Dict
        system_prompt: Optional system instructions
        metadata: Optional provider-specific metadata

    Returns:
        Final text response after all tool calls are resolved
    """
    if not mcp_tools:
        return await provider_instance.generate(
            prompt=prompt, model=model, system_prompt=system_prompt, metadata=metadata
        )

    # Build a lookup: tool_name -> connection_id
    tool_connection_map = {}
    for tool in mcp_tools:
        tool_connection_map[tool["name"]] = tool.get("connection_id", "")

    if provider_name in ("openai", "openai_chatgpt"):
        return await _openai_tool_loop(
            provider_instance, prompt, model, mcp_tools,
            tool_connection_map, tool_executor, system_prompt, metadata,
        )
    elif provider_name == "anthropic":
        return await _anthropic_tool_loop(
            provider_instance, prompt, model, mcp_tools,
            tool_connection_map, tool_executor, system_prompt, metadata,
        )
    elif provider_name == "gemini":
        return await _gemini_tool_loop(
            provider_instance, prompt, model, mcp_tools,
            tool_connection_map, tool_executor, system_prompt, metadata,
        )
    else:
        # Fallback: providers without tool support get tools described in system prompt
        tool_desc = _describe_tools_in_text(mcp_tools)
        augmented_system = (system_prompt or "") + "\n\n" + tool_desc
        return await provider_instance.generate(
            prompt=prompt, model=model, system_prompt=augmented_system, metadata=metadata,
        )


async def _openai_tool_loop(
    provider, prompt, model, mcp_tools,
    tool_connection_map, tool_executor, system_prompt, metadata,
) -> str:
    """OpenAI function-calling loop."""
    from openai import AsyncOpenAI

    openai_tools = mcp_tools_to_openai(mcp_tools)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    temp = metadata.get("temperature", 0.7) if metadata else 0.7

    for iteration in range(MAX_TOOL_ITERATIONS):
        response = await provider.client.chat.completions.create(
            model=model,
            messages=messages,
            tools=openai_tools,
            temperature=temp,
        )
        choice = response.choices[0]

        if choice.finish_reason == "tool_calls" or (choice.message.tool_calls and len(choice.message.tool_calls) > 0):
            # Append assistant message with tool calls
            messages.append(choice.message.model_dump())

            for tool_call in choice.message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                conn_id = tool_connection_map.get(fn_name, "")

                logger.info("Tool call [%d]: %s(%s)", iteration, fn_name, fn_args)
                result = await tool_executor(conn_id, fn_name, fn_args)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result.get("result", ""),
                })
        else:
            # Final text response
            return choice.message.content or ""

    logger.warning("Reached max tool iterations (%d)", MAX_TOOL_ITERATIONS)
    return messages[-1].get("content", "") if messages else ""


async def _anthropic_tool_loop(
    provider, prompt, model, mcp_tools,
    tool_connection_map, tool_executor, system_prompt, metadata,
) -> str:
    """Anthropic/Claude tool-use loop."""
    claude_tools = mcp_tools_to_anthropic(mcp_tools)
    messages = [{"role": "user", "content": prompt}]

    max_tokens = metadata.get("max_tokens", 1024) if metadata else 1024
    temp = metadata.get("temperature", 0.7) if metadata else 0.7

    for iteration in range(MAX_TOOL_ITERATIONS):
        response = await provider.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temp,
            system=system_prompt or "",
            messages=messages,
            tools=claude_tools,
        )

        # Check if response contains tool use
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        if tool_use_blocks:
            # Append assistant response
            messages.append({"role": "assistant", "content": response.content})

            # Execute each tool and build tool_result message
            tool_results = []
            for block in tool_use_blocks:
                conn_id = tool_connection_map.get(block.name, "")
                logger.info("Tool call [%d]: %s(%s)", iteration, block.name, block.input)
                result = await tool_executor(conn_id, block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result.get("result", ""),
                    "is_error": result.get("is_error", False),
                })

            messages.append({"role": "user", "content": tool_results})
        else:
            # Extract final text
            text_parts = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_parts)

    logger.warning("Reached max tool iterations (%d)", MAX_TOOL_ITERATIONS)
    return ""


async def _gemini_tool_loop(
    provider, prompt, model, mcp_tools,
    tool_connection_map, tool_executor, system_prompt, metadata,
) -> str:
    """Gemini function-calling loop."""
    import google.generativeai as genai

    declarations = mcp_tools_to_gemini(mcp_tools)
    gemini_tools = [genai.types.Tool(function_declarations=declarations)]

    gen_model = provider._genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt or None,
        tools=gemini_tools,
        generation_config=provider._genai.GenerationConfig(
            temperature=metadata.get("temperature", 0.7) if metadata else 0.7,
            max_output_tokens=metadata.get("max_tokens", 1024) if metadata else 1024,
        ),
    )

    chat = gen_model.start_chat()
    response = await chat.send_message_async(prompt)

    for iteration in range(MAX_TOOL_ITERATIONS):
        # Check for function calls in response
        fn_calls = []
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    fn_calls.append(part.function_call)

        if not fn_calls:
            return response.text

        # Execute tool calls
        fn_responses = []
        for fn_call in fn_calls:
            conn_id = tool_connection_map.get(fn_call.name, "")
            args = dict(fn_call.args) if fn_call.args else {}
            logger.info("Tool call [%d]: %s(%s)", iteration, fn_call.name, args)
            result = await tool_executor(conn_id, fn_call.name, args)
            fn_responses.append(
                genai.types.FunctionResponse(
                    name=fn_call.name,
                    response={"result": result.get("result", "")},
                )
            )

        response = await chat.send_message_async(fn_responses)

    logger.warning("Reached max tool iterations (%d)", MAX_TOOL_ITERATIONS)
    return response.text if response else ""


def _describe_tools_in_text(tools: List[Dict[str, Any]]) -> str:
    """For providers without native tool support, describe tools in text."""
    lines = ["Available tools (you cannot call them directly, but you can suggest their use):"]
    for tool in tools:
        schema = json.dumps(tool.get("input_schema", {}), indent=2)
        lines.append(f"- {tool['name']}: {tool.get('description', '')}\n  Schema: {schema}")
    return "\n".join(lines)
