# Quickstart: Multi-Provider LLM & MCP Integration

**Feature**: 011-multi-provider-llm-mcp

## Scenario 1: Register Multiple Providers

**Goal**: Add OpenAI and a local Ollama as LLM providers.

1. Open MindFlow in browser
2. Go to Settings → Providers tab
3. Click "+" to add a provider
4. Select "OpenAI API", enter name "My GPT", pick a color (green), paste API key
5. System validates → shows "Connected" with available models
6. Click "+" again, select "Local (Ollama)", name "Local LLM", enter `http://localhost:11434`
7. System checks reachability → shows "Connected" with local models

**Verify**: Both providers appear in the list with their colors and "Connected" status.

## Scenario 2: Create Provider-Assigned Nodes

**Goal**: Create nodes that use different providers.

1. On the canvas, create a new node
2. In the node creation dialog, select "My GPT" as the provider
3. Enter prompt: "Explain quantum entanglement"
4. Node appears with green color (OpenAI) and starts generating
5. Create another node, select "Local LLM" as provider
6. Enter prompt: "Explain quantum entanglement"
7. Node appears with different color and generates via Ollama

**Verify**: Both nodes show provider name/model badge. Responses come from different LLMs.

## Scenario 3: Run a Debate

**Goal**: Make two LLM nodes debate a topic.

1. Create a "My GPT" node with prompt: "Is AI consciousness possible? Argue YES."
2. Create a "Local LLM" node connected to the first via an edge
3. Select the first node → click "Start Debate"
4. Watch: GPT generates its argument → forwarded to Ollama → Ollama responds
5. Click "Continue Debate" for another round
6. Each node now has 2 responses (round 1 + round 2)

**Verify**: Full conversation history visible. Each node shows its provider's perspective.

## Scenario 4: Connect an MCP Client (Claude Code)

**Goal**: Use Claude Code to interact with the MindFlow canvas.

1. Start MindFlow (backend runs MCP server on stdio or localhost)
2. In Claude Code config, add MindFlow as an MCP server:
   ```json
   { "mcpServers": { "mindflow": { "command": "python", "args": ["-m", "mindflow.mcp_server"] } } }
   ```
3. In Claude Code, ask: "List my MindFlow canvases"
4. Claude Code calls `list_canvases` tool → shows canvas list
5. Ask: "Create a node on canvas X asking 'What is dark matter?'"
6. Claude Code calls `create_node` → node appears in MindFlow UI

**Verify**: Node created by Claude Code is visible in the browser canvas.

## Scenario 5: Connect an External MCP Server

**Goal**: Give LLM nodes access to filesystem tools via MCP.

1. Go to Settings → MCP Connections tab
2. Click "Add Connection"
3. Select "stdio", name "File System", command: `npx -y @modelcontextprotocol/server-filesystem /path/to/docs`
4. System connects → discovers tools (read_file, list_directory, etc.)
5. Create an LLM node, attach "File System" tools to it
6. Enter prompt: "Read the README.md file and summarize it"
7. LLM generates → calls `read_file` tool → MindFlow executes via MCP → result fed back → LLM summarizes

**Verify**: LLM response includes actual file content from the filesystem MCP server.

## Scenario 6: Multi-Provider Debate with MCP Tools

**Goal**: Combined workflow — debate with external tool access.

1. Register OpenAI + Claude providers
2. Connect a "Web Search" MCP server
3. Create Claude node with web search tools, prompt: "Research the latest on fusion energy"
4. Connect it to an OpenAI node (no tools), for critique
5. Start debate
6. Claude searches the web → writes a research summary → forwarded to GPT → GPT critiques the findings

**Verify**: Claude's response includes web search results. GPT's response addresses Claude's specific claims.
