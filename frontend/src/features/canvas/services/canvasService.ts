/**
 * Canvas API Service
 *
 * Handles all HTTP requests to the Canvas API endpoints.
 */

import type {
  Canvas,
  CreateCanvasRequest,
  UpdateCanvasRequest,
  CanvasListResponse,
} from '../../../types/canvas';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * List all canvases with optional filtering
 */
export async function fetchCanvases(params?: {
  owner_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CanvasListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.owner_id) searchParams.set('owner_id', params.owner_id);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const url = `${API_BASE_URL}/api/canvases?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch canvases: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single canvas by ID
 */
export async function getCanvas(canvasId: string): Promise<Canvas> {
  const response = await fetch(`${API_BASE_URL}/api/canvases/${canvasId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Canvas not found');
    }
    throw new Error(`Failed to get canvas: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new canvas
 */
export async function createCanvas(data: CreateCanvasRequest): Promise<Canvas> {
  const response = await fetch(`${API_BASE_URL}/api/canvases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 409) {
      const error = await response.json();
      throw new Error(error.detail || 'Canvas name already exists');
    }
    throw new Error(`Failed to create canvas: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update an existing canvas
 */
export async function updateCanvas(
  canvasId: string,
  data: UpdateCanvasRequest
): Promise<Canvas> {
  const response = await fetch(`${API_BASE_URL}/api/canvases/${canvasId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Canvas not found');
    }
    if (response.status === 409) {
      const error = await response.json();
      throw new Error(error.detail || 'Canvas name already exists');
    }
    throw new Error(`Failed to update canvas: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(canvasId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/canvases/${canvasId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Canvas not found');
    }
    throw new Error(`Failed to delete canvas: ${response.statusText}`);
  }
}

/**
 * Duplicate an existing canvas
 */
export async function duplicateCanvas(
  canvasId: string,
  newName?: string
): Promise<Canvas> {
  const url = new URL(`${API_BASE_URL}/api/canvases/${canvasId}/duplicate`);
  if (newName) {
    url.searchParams.set('new_name', newName);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Canvas not found');
    }
    throw new Error(`Failed to duplicate canvas: ${response.statusText}`);
  }

  return response.json();
}
