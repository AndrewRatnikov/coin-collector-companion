// v2 catalog contracts (docs/system-design_v2.md §3–§4.1). Populated as real v2 DTOs/enums
// are authored — keep this the single source of truth shared by both apps (CLAUDE.md).

export interface CatalogCoin {
  id: string;
  numistaTypeId: string | null;
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
  name: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageLicense: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
