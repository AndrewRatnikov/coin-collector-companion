'use client';

import { useState } from 'react';
import { Denomination, Grade, type CoinDto } from '@coin-collector/shared';
import type { CoinInput } from '@/lib/coins-api';

// Common US mint marks (Red Book); "None" (Philadelphia / no mark) is its own option
// rather than "P" — PRD §6.3 stores no-mark coins as `mintMark: null`, never `"P"`.
const MINT_MARKS = ['D', 'S', 'O', 'CC', 'W'];

function formatEnumLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

const inputClass = (hasError: boolean) =>
  `rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    hasError ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
  }`;

interface CoinFormProps {
  // Partial, not just CoinDto: a gap-view "add new coin" deep link seeds only
  // denomination/year/mintMark, not a full coin.
  initialCoin?: Partial<CoinDto>;
  onSubmit: (input: CoinInput) => void;
  submitting: boolean;
  submitLabel: string;
  formError?: string | null;
  fieldErrors?: Record<string, string>;
}

export function CoinForm({
  initialCoin,
  onSubmit,
  submitting,
  submitLabel,
  formError,
  fieldErrors = {},
}: CoinFormProps) {
  const [denomination, setDenomination] = useState<Denomination>(
    initialCoin?.denomination ?? Denomination.Cent,
  );
  const [year, setYear] = useState(initialCoin ? String(initialCoin.year) : '');
  const [mintMark, setMintMark] = useState(initialCoin?.mintMark ?? '');
  const [country, setCountry] = useState(initialCoin?.country ?? 'US');
  const [grade, setGrade] = useState<Grade | ''>(initialCoin?.grade ?? '');
  const [purchasePrice, setPurchasePrice] = useState(initialCoin?.purchasePrice ?? '');
  const [notes, setNotes] = useState(initialCoin?.notes ?? '');
  const [acquiredDate, setAcquiredDate] = useState(initialCoin?.acquiredDate?.slice(0, 10) ?? '');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      denomination,
      year: Number(year),
      mintMark: mintMark === '' ? null : mintMark,
      country: country.trim() === '' ? 'US' : country.trim(),
      grade: grade === '' ? null : grade,
      purchasePrice: purchasePrice.trim() === '' ? null : purchasePrice.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
      acquiredDate: acquiredDate === '' ? null : acquiredDate,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="denomination" className="text-sm font-medium">
          Denomination
        </label>
        <select
          id="denomination"
          value={denomination}
          onChange={(e) => setDenomination(e.target.value as Denomination)}
          className={inputClass(Boolean(fieldErrors.denomination))}
        >
          {Object.values(Denomination).map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
        {fieldErrors.denomination && <p className="text-sm text-red-600">{fieldErrors.denomination}</p>}
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="year" className="text-sm font-medium">
            Year
          </label>
          <input
            id="year"
            type="number"
            required
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputClass(Boolean(fieldErrors.year))}
          />
          {fieldErrors.year && <p className="text-sm text-red-600">{fieldErrors.year}</p>}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="mintMark" className="text-sm font-medium">
            Mint mark
          </label>
          <select
            id="mintMark"
            value={mintMark}
            onChange={(e) => setMintMark(e.target.value)}
            className={inputClass(Boolean(fieldErrors.mintMark))}
          >
            <option value="">None</option>
            {MINT_MARKS.map((mark) => (
              <option key={mark} value={mark}>
                {mark}
              </option>
            ))}
          </select>
          {fieldErrors.mintMark && <p className="text-sm text-red-600">{fieldErrors.mintMark}</p>}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="country" className="text-sm font-medium">
            Country
          </label>
          <input
            id="country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClass(Boolean(fieldErrors.country))}
          />
          {fieldErrors.country && <p className="text-sm text-red-600">{fieldErrors.country}</p>}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="grade" className="text-sm font-medium">
            Grade
          </label>
          <select
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade | '')}
            className={inputClass(Boolean(fieldErrors.grade))}
          >
            <option value="">Ungraded</option>
            {Object.values(Grade).map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
          {fieldErrors.grade && <p className="text-sm text-red-600">{fieldErrors.grade}</p>}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="purchasePrice" className="text-sm font-medium">
            Purchase price (USD)
          </label>
          <input
            id="purchasePrice"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 12.50"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className={inputClass(Boolean(fieldErrors.purchasePrice))}
          />
          {fieldErrors.purchasePrice && (
            <p className="text-sm text-red-600">{fieldErrors.purchasePrice}</p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="acquiredDate" className="text-sm font-medium">
            Acquired date
          </label>
          <input
            id="acquiredDate"
            type="date"
            value={acquiredDate}
            onChange={(e) => setAcquiredDate(e.target.value)}
            className={inputClass(Boolean(fieldErrors.acquiredDate))}
          />
          {fieldErrors.acquiredDate && (
            <p className="text-sm text-red-600">{fieldErrors.acquiredDate}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass(Boolean(fieldErrors.notes))}
        />
        {fieldErrors.notes && <p className="text-sm text-red-600">{fieldErrors.notes}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
