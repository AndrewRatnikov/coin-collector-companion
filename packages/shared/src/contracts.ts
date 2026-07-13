// Response contract shapes for the apps/api endpoints whose payloads are non-obvious
// (system-design.md §4). This package is the single source of truth: if the Nest DTOs
// and this file ever drift, this file wins.
//
// Conventions (SD §4): `null` is meaningful and never interchangeable with field
// omission (e.g. `mintMark: null` = no mint mark, PRD §6.3); all timestamps are
// ISO 8601 UTC strings.

import type { Denomination, Grade } from './enums.js';

export interface SetSummaryRef {
  id: string;
  name: string;
  category: string;
  denomination: Denomination;
}

// GET /api/v1/user-sets -> UserSetSummary[]
export interface UserSetSummary {
  userSetId: string;
  set: SetSummaryRef;
  totalSlots: number;
  ownedSlots: number; // client derives % — one rounding rule, defined client-side
  isComplete: boolean; // ownedSlots === totalSlots && totalSlots > 0
  activatedAt: string;
}

export interface GapSlotLinkedCoin {
  coinId: string;
  grade: Grade | null;
  acquiredDate: string | null;
}

// GET /api/v1/user-sets/:id/gap -> GapViewResponse
export interface GapSlot {
  slotId: string;
  year: number;
  mintMark: string | null;
  label: string | null; // client renders label ?? `${year}${mintMark ? `-${mintMark}` : ''}`
  sortOrder: number;
  isKeyDate: boolean;
  linkedCoin: GapSlotLinkedCoin | null; // null = missing; the two-state rule is this field's nullability
}

export interface GapViewResponse {
  userSetId: string;
  set: SetSummaryRef;
  totalSlots: number;
  ownedSlots: number;
  slots: GapSlot[]; // ordered by sortOrder; grid grouping is client-side presentation
}

export interface CoinDto {
  id: string;
  denomination: Denomination;
  year: number;
  mintMark: string | null;
  country: string;
  grade: Grade | null;
  purchasePrice: string | null; // Decimal serialized as string to avoid float rounding
  notes: string | null;
  acquiredDate: string | null;
  imageUrls: string[];
  slotId: string | null;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/coins (and PATCH when denomination/year/mint changed) -> CoinMutationResponse
export interface SlotSuggestion {
  slotId: string;
  setName: string; // "Lincoln Wheat Cents"
  slotLabel: string; // display-ready: "1909-S VDB" / "1955"
  isKeyDate: boolean;
  currentlyLinkedCoinId: string | null; // non-null => UI shows "Replace current link"
}

export interface CoinMutationResponse {
  coin: CoinDto;
  suggestions: SlotSuggestion[]; // [] = no panel; 1 = one-tap confirm; >1 = picker (routine path, PRD §4.3)
}

// POST /api/v1/coins/:id/link -> CoinLinkResponse
// (replacedCoinId lets the UI toast "replaced — old coin kept in collection")
export interface CoinLinkResponse {
  coin: CoinDto;
  replacedCoinId: string | null;
}
