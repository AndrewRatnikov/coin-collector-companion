import { useQuery } from '@tanstack/react-query';
import { getCatalog, getCoin, type CatalogFilters } from '@/lib/catalog-api';

export function useCatalog(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => getCatalog(filters),
  });
}

export function useCoin(id: string) {
  return useQuery({
    queryKey: ['catalog', 'coin', id],
    queryFn: () => getCoin(id),
    enabled: Boolean(id),
  });
}
