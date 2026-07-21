// v2 catalog contracts (docs/system-design_v2.md §3–§4.1). Populated as real v2 DTOs/enums
// are authored — keep this the single source of truth shared by both apps (CLAUDE.md).

export interface CatalogCoin {
  id: string;
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

export interface UserSetSummary {
  id: string;
  userId: string;
  name: string;
  clonedFromCanonicalId: string | null;
  clonedFromUserSetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneFromRequest {
  type: 'canonical' | 'user';
  id: string;
}

export interface CreateSetRequestBody {
  name: string;
  cloneFrom?: CloneFromRequest;
}

export interface CanonicalSetSummary {
  id: string;
  name: string;
  description: string | null;
  source: string;
  templateVersion: string;
}

export interface CanonicalSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface CanonicalSetDetail extends CanonicalSetSummary {
  coins: CanonicalSetCoinItem[];
}

export interface UserSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface UserSetDetail extends UserSetSummary {
  coins: UserSetCoinItem[];
}

export interface UserSetCoinSummary {
  id: string;
  userSetId: string;
  coinId: string;
  position: number;
}

export interface PatchSetCoinsRequest {
  add?: string[];
  remove?: string[];
}

export interface OwnershipItem {
  coinId: string;
  coin: CatalogCoin;
  ownedAt: Date;
}

export interface SetOwnershipRequest {
  owned: boolean;
}

export interface SetOwnershipResponse {
  coinId: string;
  owned: boolean;
  ownedAt: Date | null;
}

export interface GapSlot {
  id: string;
  position: number;
  coin: CatalogCoin;
  owned: boolean;
}

export interface GapViewResponse {
  setId: string;
  ownedCount: number;
  totalCount: number;
  completionPercent: number;
  slots: GapSlot[];
}
