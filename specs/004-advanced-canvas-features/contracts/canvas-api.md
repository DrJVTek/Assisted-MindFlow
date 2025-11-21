# API Contract: Canvas Management

**Endpoint Group**: /api/canvases  
**Feature**: 004-advanced-canvas-features

---

## GET /api/canvases

List all canvases for current user.

### Request
- Method: GET
- Query Parameters:
  - limit: int (default 100, max 1000)
  - offset: int (default 0)
  - filter: string (optional, search by name)

### Response 200 OK
```json
{
  "canvases": [
    {
      "id": "uuid",
      "name": "Project Alpha",
      "description": "Main research canvas",
      "graph_id": "uuid",
      "created_at": "2025-11-18T10:00:00Z",
      "updated_at": "2025-11-18T15:30:00Z",
      "last_opened": "2025-11-18T15:30:00Z",
      "thumbnail": "data:image/png;base64,...",
      "is_subgraph": false
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

---

## POST /api/canvases

Create a new canvas.

### Request
```json
{
  "name": "New Canvas",
  "description": "Optional description"
}
```

### Response 201 Created
```json
{
  "id": "new-uuid",
  "name": "New Canvas",
  "description": "Optional description",
  "graph_id": "graph-uuid",
  "created_at": "2025-11-18T16:00:00Z",
  "updated_at": "2025-11-18T16:00:00Z",
  "last_opened": "2025-11-18T16:00:00Z",
  "thumbnail": null,
  "is_subgraph": false
}
```

### Error Responses
- 400 Bad Request: Invalid name (empty or too long)
- 409 Conflict: Canvas name already exists for user

---

## GET /api/canvases/{canvas_id}

Get canvas details.

### Response 200 OK
Returns full Canvas object.

### Error Responses
- 404 Not Found: Canvas does not exist

---

## PUT /api/canvases/{canvas_id}

Update canvas metadata.

### Request
```json
{
  "name": "Renamed Canvas",
  "description": "Updated description",
  "thumbnail": "data:image/png;base64,..."
}
```

### Response 200 OK
Returns updated Canvas object.

---

## DELETE /api/canvases/{canvas_id}

Delete a canvas and its associated graph.

### Response 204 No Content

### Error Responses
- 404 Not Found: Canvas does not exist
- 409 Conflict: Canvas is a sub-graph template with active instances

---

## POST /api/canvases/{canvas_id}/duplicate

Duplicate a canvas (deep copy of all nodes).

### Response 201 Created
Returns new Canvas object.

