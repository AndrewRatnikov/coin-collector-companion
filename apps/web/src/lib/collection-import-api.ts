import type {
  ImportColumnMapping,
  ImportConfirmResponse,
  ImportPreviewResponse,
} from '@coin-collector/shared';
import { apiFetch } from './api-client';

// Multipart upload: apiFetch leaves Content-Type unset for FormData so the browser adds the boundary.
export async function previewImport(
  file: File,
  mapping?: ImportColumnMapping,
): Promise<ImportPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping !== undefined) {
    formData.append('mapping', JSON.stringify(mapping));
  }
  return apiFetch<ImportPreviewResponse>('/collection/import/preview', {
    method: 'POST',
    body: formData,
  });
}

export async function confirmImport(coinIds: string[]): Promise<ImportConfirmResponse> {
  return apiFetch<ImportConfirmResponse>('/collection/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ coinIds }),
  });
}
