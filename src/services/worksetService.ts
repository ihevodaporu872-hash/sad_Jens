import { Workset, WorksetCreateRequest, WorksetUpdateRequest } from '../types/ifc';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string;
    try {
      const body = await response.json();
      message = body.message || body.error || response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new Error(message);
  }
  return response.json();
}

export async function getWorksets(modelId: string): Promise<Workset[]> {
  const response = await fetch(`${API_BASE}/models/${modelId}/worksets`);
  return handleResponse<Workset[]>(response);
}

export async function createWorkset(modelId: string, data: WorksetCreateRequest): Promise<Workset> {
  const response = await fetch(`${API_BASE}/models/${modelId}/worksets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Workset>(response);
}

export async function updateWorkset(
  modelId: string,
  worksetId: string,
  data: WorksetUpdateRequest
): Promise<Workset> {
  const response = await fetch(`${API_BASE}/models/${modelId}/worksets/${worksetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Workset>(response);
}

export async function deleteWorkset(modelId: string, worksetId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/models/${modelId}/worksets/${worksetId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    let message: string;
    try {
      const body = await response.json();
      message = body.message || body.error || response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new Error(message);
  }
}
