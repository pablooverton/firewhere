'use client';

import { bridgeYears, hasLongBridge, SOCIAL_SECURITY_EARLIEST_AGE } from '@/domain/fire';
import type { Country, FireResult, Mode } from '@/domain/types';
import { confidenceColor, formatAge, formatUSD, formatYears, safetyColor } from '@/lib/format';
import { SortableTh, type SortDir } from './SortableTh';

export type SortKey = 'country' | 'fireAge' | 'years' | 'spend' | 'fireNumber' | 'safety' | 'confidence';

interface Props {
  sortedResults: FireResult[];
  countryById: Record<string, Country>;
  totalCountries: number;
  visibleCount: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  mode: Mode;
  targetAge: number;
}

export function ResultsTable({
  sortedResults,
  countryById,
  totalCountries,
  visibleCount,
  sortKey,
  sortDir,
  onSort,
  mode,
  targetAge,
}: Props) {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-white mb-4">
        Results <span className="text-sm text-gray-500 font-normal">({visibleCount} of {totalCountries} countries)</span>
      </h2>
      {visibleCount === 0 ? (
        <div className="p-8 rounded-lg border border-gray-800 bg-gray-900/30 text-center text-gray-500">
          No countries match the current filters. Try widening the region selection or relaxing the safety threshold.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <SortableTh<SortKey> sortKey="country" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                  tooltip="Country name, 2-letter code, and region. Click to sort alphabetically.">
                  Country
                </SortableTh>
                <SortableTh<SortKey>
                  sortKey="fireAge"
                  activeKey={sortKey}
                  dir={sortDir}
                  onClick={onSort}
                  align="right"
                  tooltip={
                    mode === 'coast'
                      ? `CoastFIRE age — the age at which you can stop saving and let the portfolio grow without contributions to reach the FIRE number by your target retirement age (${targetAge}). Equals current age + years to coast.`
                      : 'The age at which you can stop working, assuming you relocate here. Equals current age + years to FIRE.'
                  }
                >
                  {mode === 'coast' ? 'Coast age' : 'FIRE age'}
                </SortableTh>
                <SortableTh<SortKey>
                  sortKey="years"
                  activeKey={sortKey}
                  dir={sortDir}
                  onClick={onSort}
                  align="right"
                  tooltip={
                    mode === 'coast'
                      ? `Years from today until you can stop saving. After this point, contributions can stop and the portfolio compounds at the expected real return until the target retirement age (${targetAge}).`
                      : 'Years from today until your portfolio reaches the FIRE number, solved from compound growth: P(t) = currentSavings × (1+r)^t + annualSavings × ((1+r)^t − 1) / r.'
                  }
                >
                  {mode === 'coast' ? 'Years to coast' : 'Years'}
                </SortableTh>
                <SortableTh<SortKey> sortKey="spend" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                  tooltip="Annual spending in USD localized to this country. Formula: (your US baseline spending × cost-of-living multiplier) + annual healthcare cost.">
                  Annual spend
                </SortableTh>
                <SortableTh<SortKey> sortKey="fireNumber" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                  tooltip="Portfolio size at which a 4% safe withdrawal rate covers your localized annual spend after tax. Formula: annual spend / (1 − tax rate) / SWR.">
                  FIRE number
                </SortableTh>
                <SortableTh<SortKey> sortKey="safety" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                  tooltip="Global Peace Index 2025 score. 1.0 = most peaceful, ~3.5 = least. Lower is safer. The GPI rank (out of 163 countries) is shown when you hover the badge in the row.">
                  Safety
                </SortableTh>
                <SortableTh<SortKey> sortKey="confidence" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                  tooltip="How well-supported the country's parameters are by public data. High = well-documented baseline (US). Medium = standard public sources cited. Low = limited public data or rapidly-changing tax/visa rules.">
                  Confidence
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((r) => {
                const c = countryById[r.countryId];
                const showBridge = mode === 'fire' && hasLongBridge(r.fireAge);
                return (
                  <tr key={r.countryId} className="border-t border-gray-800 hover:bg-gray-900/40">
                    <td className="px-4 py-3 text-white">
                      <span className="font-medium">{c?.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{c?.flag}</span>
                      <div className="text-xs text-gray-600">{c?.region}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono whitespace-nowrap">
                      {showBridge && (
                        <span
                          className="mr-1 text-amber-400"
                          title={`Long pre-SS bridge: ${bridgeYears(r.fireAge).toFixed(0)} yrs to Social Security at ${SOCIAL_SECURITY_EARLIEST_AGE}. See country notes below.`}
                          aria-label="Long pre-Social Security bridge warning"
                        >
                          ⚠
                        </span>
                      )}
                      {formatAge(r.fireAge)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatYears(r.yearsToFire)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUSD(r.localizedSpending)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUSD(r.fireNumber)}
                    </td>
                    <td className="px-4 py-3">
                      {c && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs border font-mono ${safetyColor(c.safetyScore)}`}
                          title={`GPI rank: ${c.safetyRank}`}
                        >
                          {c.safetyScore.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs border ${confidenceColor(r.confidence)}`}
                      >
                        {r.confidence}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
