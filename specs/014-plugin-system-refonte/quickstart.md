# Quickstart: Plugin System Refonte

**Branch**: `014-plugin-system-refonte` | **Date**: 2026-03-15

## Scenario 1: Add a New LLM Provider (Plugin Author)

1. Create a directory `plugins/core/llm_newprovider/`
2. Create `__init__.py` with `PLUGIN_MANIFEST` and `NODE_CLASS_MAPPINGS`
3. Create `nodes.py` with a node class implementing `INPUT_TYPES()`, `RETURN_TYPES`, `FUNCTION`, and the execution method
4. Restart the server
5. **Expected**: The new provider appears in `GET /api/node-types` and in the frontend node creator under its category

## Scenario 2: Build and Execute a Multi-Node Workflow (End User)

1. Open the canvas
2. Create a "Text Input" node and type a question
3. Create an "OpenAI Chat" node
4. Connect Text Input's `text` output to OpenAI Chat's `prompt` input
5. Click "Execute" on the OpenAI Chat node
6. **Expected**: Text Input executes first (instant, non-streaming), then OpenAI Chat streams its response token-by-token

## Scenario 3: Incremental Re-Execution (End User)

1. From Scenario 2, the graph is executed and all nodes are clean
2. Modify the Text Input node's content
3. Click "Execute" on the OpenAI Chat node again
4. **Expected**: Text Input re-executes (dirty), OpenAI Chat re-executes (dirty because ancestor changed). SSE events show `node_start` for Text Input, then streaming for OpenAI Chat.

## Scenario 4: Cached Execution (End User)

1. From Scenario 2, the graph is executed and all nodes are clean
2. Click "Execute" on the OpenAI Chat node WITHOUT changing any inputs
3. **Expected**: Both nodes are skipped (clean), SSE events show `node_skip` for both. The cached response is returned instantly.

## Scenario 5: Type Validation on Connection (End User)

1. Create a "Text Input" node (output: STRING)
2. Create an "OpenAI Chat" node (input `temperature`: FLOAT)
3. Try to connect Text Input's `text` output to OpenAI Chat's `temperature` input
4. **Expected**: Connection is rejected — STRING is not compatible with FLOAT. Visual indicator shows incompatibility.

## Scenario 6: Install a Community Plugin (Power User)

1. Clone or copy a plugin directory into `plugins/community/my_plugin/`
2. Restart the server
3. **Expected**: Server logs a warning "Loading community plugin: my_plugin" and the plugin's nodes appear in the frontend node creator

## Scenario 7: Missing Credential Error (End User)

1. Create an "OpenAI Chat" node without configuring an OpenAI API key
2. Click "Execute"
3. **Expected**: Execution fails with clear error: "Missing credential: OpenAI API Key". No silent fallback, no environment variable guessing.

## Scenario 8: Graph with Cycle (End User)

1. Create nodes A and B
2. Connect A → B and B → A
3. Click "Execute" on A
4. **Expected**: System detects cycle before execution begins, shows error: "Graph contains a cycle"
