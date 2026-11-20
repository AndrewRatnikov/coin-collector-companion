'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { gradeShortLabel } from '@/lib/grades';
import type { WantGroup, WantListMint, WantListYear } from '@/lib/missing-list';

export interface WantListTableProps {
  groups: WantGroup[];
  /** Default: shown when there are two or more groups. */
  showGroupHeadings?: boolean;
  /** Shown for a mint with an empty label (a plain coin). */
  plainLabel: string;
  variant: 'missing' | 'upgrade';
  /** Applied to the root, e.g. a top margin. */
  className?: string;
}

/**
 * Every want list's format: groups by (country, denomination), one row per year, the mints of a
 * year on one line. The upgrade variant appends "(grade → target)" to each mint.
 */
export function WantListTable({ groups, showGroupHeadings, plainLabel, variant, className }: WantListTableProps) {
  const { t } = useTranslation();
  const showHeadings = showGroupHeadings ?? groups.length > 1;

  function mintText(mint: WantListMint): string {
    const base = `${mint.label || plainLabel}${mint.isKeyDate ? ' ★' : ''}`;
    if (variant !== 'upgrade' || !mint.targetGrade) return base;
    const from = mint.grade ? gradeShortLabel(t, mint.grade) : t('missingList.noGrade');
    return `${base} (${from} → ${gradeShortLabel(t, mint.targetGrade)})`;
  }

  function mintsText(row: WantListYear): string {
    return row.mints.map(mintText).join(' · ');
  }

  return (
    <div data-testid="want-list-table" data-variant={variant} className={className}>
      {groups.map((group, index) => (
        <div
          key={group.key}
          data-testid="want-list-group"
          data-group-key={group.key}
          className={showHeadings && index > 0 ? 'mt-3' : undefined}
        >
          {showHeadings && (
            <h3 data-testid="want-list-group-heading" className="mb-1 text-[13px] font-medium text-neutral-800">
              {`${group.country} · ${group.denomination}`}
            </h3>
          )}
          <table className="w-full border-collapse font-mono text-[13px]">
            <tbody>
              {group.years.map((row) => (
                <tr
                  key={row.year}
                  data-testid="want-list-row"
                  data-year={row.year}
                  className="border-b border-dashed border-neutral-300 last:border-b-0"
                >
                  <th
                    scope="row"
                    data-testid="want-list-year"
                    className="w-16 py-1.5 text-left align-top font-medium text-text"
                  >
                    {row.year}
                  </th>
                  <td data-testid="want-list-mints" className="py-1.5 text-neutral-800">
                    {mintsText(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
