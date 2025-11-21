# API Contract: Sub-Graph Management

**Endpoint Group**: /api/subgraphs  
**Feature**: 004-advanced-canvas-features

---

## GET /api/subgraphs

List all sub-graph templates.

### Request
- Query Parameters:
  - tags: string[] (optional filter)
  - sort: usage | recent | name (default: usage)

### Response 200 OK
---

## POST /api/subgraphs

Create a new sub-graph template from a canvas.

### Request
### Response 201 Created
Returns SubGraphTemplate object.

### Error Responses
- 400 Bad Request: Invalid port node IDs
- 404 Not Found: Canvas not found
- 409 Conflict: Circular dependency detected

---

## POST /api/canvases/{canvas_id}/subgraph-instances

Instantiate a sub-graph template on a canvas.

### Request
### Response 201 Created
Returns SubGraphInstance object.

---

## POST /api/subgraph-instances/{instance_id}/localize

Convert an instance to a localized copy.

### Response 200 OK
Returns updated SubGraphInstance with is_localized=true.

---

## PUT /api/subgraphs/{template_id}

Update sub-graph template metadata.

### Request
### Response 200 OK
Returns updated SubGraphTemplate.

