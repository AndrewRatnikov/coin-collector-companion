// Mirrored 1:1 as Prisma enums in apps/api's schema (PRD §6.2) — this package is the
// source of truth; the Prisma schema follows these member names, not the other way round.

export enum Denomination {
  Cent = 'Cent',
  Nickel = 'Nickel',
  Dime = 'Dime',
  Quarter = 'Quarter',
  HalfDollar = 'HalfDollar',
  Dollar = 'Dollar',
}

// Small enum by design (PRD §6.3) — not the full Sheldon 1-70 numeric scale.
export enum Grade {
  Poor = 'Poor',
  Fair = 'Fair',
  Good = 'Good',
  VeryGood = 'VeryGood',
  Fine = 'Fine',
  VeryFine = 'VeryFine',
  ExtremelyFine = 'ExtremelyFine',
  AboutUncirculated = 'AboutUncirculated',
  Uncirculated = 'Uncirculated',
}
