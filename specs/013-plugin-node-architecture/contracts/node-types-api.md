# API Contract: Node Types Discovery

**Endpoint**: `GET /api/node-types`
**Purpose**: Returns all available node type definitions from the plugin registry for dynamic frontend rendering.

## Request

No parameters required.

## Response (200 OK)

```json
{
  "node_types": {
    "<node_type_id>": {
      "display_name": "string",
      "category": "string",
      "streaming": "boolean",
      "ui": {
        "color": "string (hex)",
        "icon": "string",
        "width": "integer (optional)",
        "min_height": "integer (optional)"
      },
      "inputs": {
        "required": {
          "<input_name>": ["<TYPE>", { "<option>": "<value>" }]
        },
        "optional": {
          "<input_name>": ["<TYPE>", { "<option>": "<value>" }]
        },
        "credentials": {
          "<cred_name>": ["SECRET", { "label": "string" }]
        }
      },
      "return_types": ["<TYPE>", ...],
      "return_names": ["<name>", ...],
      "function": "string"
    }
  },
  "type_definitions": {
    "<TYPE>": {
      "color": "string (hex)",
      "description": "string",
      "is_connection_type": "boolean"
    }
  },
  "categories": [
    {
      "id": "string",
      "display_name": "string",
      "icon": "string (optional)"
    }
  ]
}
```

## Example Response

```json
{
  "node_types": {
    "llm_chat": {
      "display_name": "LLM Chat",
      "category": "llm",
      "streaming": true,
      "ui": {
        "color": "#2196F3",
        "icon": "chat",
        "width": 400,
        "min_height": 300
      },
      "inputs": {
        "required": {
          "prompt": ["STRING", {"multiline": true, "max_length": 10000, "placeholder": "Enter your prompt..."}],
          "provider": ["COMBO", {"options_from": "providers", "label": "LLM Provider"}],
          "model": ["COMBO", {"options_from": "provider_models", "depends_on": "provider"}]
        },
        "optional": {
          "system_prompt": ["STRING", {"multiline": true, "default": ""}],
          "temperature": ["FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.1}],
          "max_tokens": ["INT", {"default": 4096, "min": 1, "max": 128000}],
          "context": ["CONTEXT", {}]
        }
      },
      "return_types": ["STRING", "USAGE"],
      "return_names": ["response", "usage_info"],
      "function": "generate"
    },
    "text_input": {
      "display_name": "Text Input",
      "category": "input",
      "streaming": false,
      "ui": {"color": "#4CAF50", "icon": "text"},
      "inputs": {
        "required": {
          "text": ["STRING", {"multiline": true, "max_length": 50000}]
        }
      },
      "return_types": ["STRING"],
      "return_names": ["text"],
      "function": "execute"
    }
  },
  "type_definitions": {
    "STRING": {"color": "#8BC34A", "description": "Text content", "is_connection_type": true},
    "CONTEXT": {"color": "#00BCD4", "description": "Conversation context", "is_connection_type": true},
    "USAGE": {"color": "#795548", "description": "Token usage info", "is_connection_type": true},
    "COMBO": {"color": "#607D8B", "description": "Selection from options", "is_connection_type": false},
    "SECRET": {"color": "#F44336", "description": "Encrypted credential", "is_connection_type": false}
  },
  "categories": [
    {"id": "llm", "display_name": "LLM", "icon": "brain"},
    {"id": "input", "display_name": "Input", "icon": "text"},
    {"id": "transform", "display_name": "Transform", "icon": "shuffle"},
    {"id": "tools", "display_name": "Tools", "icon": "wrench"},
    {"id": "output", "display_name": "Output", "icon": "download"}
  ]
}
```

## Error Responses

- **500 Internal Server Error**: Plugin registry failed to initialize
  ```json
  {"detail": "Plugin registry not initialized"}
  ```

## Notes

- Response is cached in memory (plugins loaded at startup only)
- Frontend should call this once at startup and cache in `nodeTypesStore`
- `options_from: "providers"` means the dropdown options come from the provider registry, not the plugin definition
- `depends_on: "provider"` means the model list updates when the provider selection changes
