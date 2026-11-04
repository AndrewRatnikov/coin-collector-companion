import type {
  ImportColumnMapping,
  ImportConfirmGrade,
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

// Without grades the body stays exactly { coinIds }, as before grades existed.
export async function confirmImport(
  coinIds: string[],
  grades: ImportConfirmGrade[] = [],
): Promise<ImportConfirmResponse> {
  return apiFetch<ImportConfirmResponse>('/collection/import/confirm', {
    method: 'POST',
    body: JSON.stringify(grades.length === 0 ? { coinIds } : { coinIds, grades }),
  });
}
