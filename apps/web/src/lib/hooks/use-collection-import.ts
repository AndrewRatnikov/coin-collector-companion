import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ImportColumnMapping,
  ImportConfirmResponse,
  ImportPreviewResponse,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { confirmImport, previewImport } from '@/lib/collection-import-api';

// Preview is read-only on the server, so it invalidates nothing.
export function usePreviewImport() {
  return useMutation<
    ImportPreviewResponse,
    ApiError,
    { file: File; mapping?: ImportColumnMapping }
  >({
    mutationFn: ({ file, mapping }) => previewImport(file, mapping),
  });
}

export function useConfirmImport() {
  const queryClient = useQueryClient();
  return useMutation<ImportConfirmResponse, ApiError, string[]>({
    mutationFn: (coinIds) => confirmImport(coinIds),
    onSuccess: () => {
      // Ownership is global, so every collection, set and gap view (the dashboard reads
      // ['user-sets', id, 'gaps']) may have changed.
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
      queryClient.invalidateQueries({ queryKey: ['public-sets'] });
      queryClient.invalidateQueries({ queryKey: ['canonical-sets'] });
    },
  });
}
