'use client';

import { useMemo, useState } from 'react';
import { computeAll, filterCountries } from '@/domain/fire';
import {
  ALL_FAITHS,
  ALL_REGIONS,
  type Country,
  type DataSource,
  type EnglishLevel,
  type Faith,
  type FilterCriteria,
  type Region,
  type SafetyThreshold,
  type UserInputs,
  type VisaDifficulty,
  VISA_OPTIONS,
} from '@/domain/types';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  countries: Country[];
  dataSources: { safety: DataSource; costOfLiving: DataSource };
}

const defaultInputs: UserInputs = {
  currentSavings: 250_000,
  annualSavings: 40_000,
  currentSpending: 60_000,
  currentAge: 40,
  realReturn: 0.05,
};

const defaultFilters: FilterCriteria = {
  regions: [...ALL_REGIONS],
  safety: 'any',
  faiths: [],
  visa: 'any',
  english: 'any',
};

const SAFETY_OPTIONS: Array<{ value: SafetyThreshold; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'moderate', label: 'Moderate (GPI ≤ 2.5)' },
  { value: 'safe', label: 'Safe (GPI ≤ 2.0)' },
  { value: 'very-safe', label: 'Very safe (GPI ≤ 1.5)' },
];

const ENGLISH_OPTIONS: Array<{ value: EnglishLevel | 'any'; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'limited', label: 'Limited or better' },
  { value: 'urban', label: 'Urban areas at minimum' },
  { value: 'widespread', label: 'Widespread (near-universal)' },
];

function countActiveAdvancedFilters(f: FilterCriteria): number {
  let n = 0;
  if (f.safety !== 'any') n++;
  if (f.faiths.length > 0) n++;
  if (f.visa !== 'any') n++;
  if (f.english !== 'any') n++;
  return n;
}

type SortKey = 'country' | 'fireAge' | 'years' | 'spend' | 'fireNumber' | 'safety' | 'confidence';
type SortDir = 'asc' | 'desc';

const CONFIDENCE_ORDER: Record<Country['confidence'], number> = { high: 0, medium: 1, low: 2 };

/** Numeric compare that pushes Infinity (unreachable) to the end on ascending sorts. */
function cmpNum(a: number, b: number): number {
  const aFin = Number.isFinite(a);
  const bFin = Number.isFinite(b);
  if (!aFin && !bFin) return 0;
  if (!aFin) return 1;
  if (!bFin) return -1;
  return a - b;
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatYears(n: number): string {
  if (!Number.isFinite(n)) return 'unreachable';
  if (n <= 0) return 'already there';
  return `${n.toFixed(1)} yrs`;
}

function formatAge(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

function confidenceColor(c: Country['confidence']): string {
  if (c === 'high') return 'bg-green-900/40 text-green-300 border-green-800';
  if (c === 'medium') return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-red-900/40 text-red-300 border-red-800';
}

function safetyColor(score: number): string {
  if (score <= 1.5) return 'bg-green-900/40 text-green-300 border-green-800';
  if (score <= 2.0) return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
  if (score <= 2.5) return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-red-900/40 text-red-300 border-red-800';
}

export function Calculator({ countries, dataSources }: Props) {
  const safetySource = dataSources.safety;
  const [inputs, setInputs] = useState<UserInputs>(defaultInputs);
  const [filters, setFilters] = useState<FilterCriteria>(defaultFilters);
  const [sortKey, setSortKey] = useState<SortKey>('fireAge');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const visibleCountries = useMemo(
    () => filterCountries(countries, filters),
    [countries, filters]
  );
  const results = useMemo(() => computeAll(inputs, visibleCountries), [inputs, visibleCountries]);
  const countryById = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.id, c])),
    [countries]
  );

  const sortedResults = useMemo(() => {
    const items = results.slice();
    items.sort((a, b) => {
      const ca = countryById[a.countryId];
      const cb = countryById[b.countryId];
      let cmp = 0;
      switch (sortKey) {
        case 'country':
          cmp = (ca?.name ?? '').localeCompare(cb?.name ?? '');
          break;
        case 'fireAge':
          cmp = cmpNum(a.fireAge, b.fireAge);
          break;
        case 'years':
          cmp = cmpNum(a.yearsToFire, b.yearsToFire);
          break;
        case 'spend':
          cmp = cmpNum(a.localizedSpending, b.localizedSpending);
          break;
        case 'fireNumber':
          cmp = cmpNum(a.fireNumber, b.fireNumber);
          break;
        case 'safety':
          cmp = cmpNum(ca?.safetyScore ?? Infinity, cb?.safetyScore ?? Infinity);
          break;
        case 'confidence':
          cmp = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [results, sortKey, sortDir, countryById]);

  const update = <K extends keyof UserInputs>(key: K, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRegion = (r: Region) => {
    setFilters((prev) => {
      const has = prev.regions.includes(r);
      const next = has ? prev.regions.filter((x) => x !== r) : [...prev.regions, r];
      return { ...prev, regions: next };
    });
  };

  const toggleFaith = (f: Faith) => {
    setFilters((prev) => {
      const has = prev.faiths.includes(f);
      const next = has ? prev.faiths.filter((x) => x !== f) : [...prev.faiths, f];
      return { ...prev, faiths: next };
    });
  };

  const resetAdvanced = () => {
    setFilters((prev) => ({
      ...prev,
      safety: 'any',
      faiths: [],
      visa: 'any',
      english: 'any',
    }));
  };

  const advancedCount = countActiveAdvancedFilters(filters);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg border border-gray-800 bg-gray-900/50">
        <NumberField
          label="Current savings (USD)"
          value={inputs.currentSavings}
          onChange={(v) => update('currentSavings', v)}
          step={5000}
          min={0}
        />
        <NumberField
          label="Annual savings (USD/yr)"
          value={inputs.annualSavings}
          onChange={(v) => update('annualSavings', v)}
          step={1000}
          min={0}
        />
        <NumberField
          label="Annual spending baseline (USD, US-equivalent)"
          value={inputs.currentSpending}
          onChange={(v) => update('currentSpending', v)}
          step={1000}
          min={0}
        />
        <NumberField
          label="Current age"
          value={inputs.currentAge}
          onChange={(v) => update('currentAge', v)}
          step={1}
          min={0}
          max={100}
        />
        <NumberField
          label="Expected real return (%)"
          value={Math.round(inputs.realReturn * 1000) / 10}
          onChange={(v) => update('realReturn', v / 100)}
          step={0.1}
          min={-5}
          max={20}
        />
      </section>

      <section className="p-4 rounded-lg border border-gray-800 bg-gray-900/30 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            Region
            <InfoTooltip
              position="bottom"
              text="Filter results by region. Toggle a chip to include or exclude its countries. All regions are active by default."
            />
          </h2>
          <div className="flex flex-wrap gap-2">
            {ALL_REGIONS.map((r) => {
              const active = filters.regions.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    active
                      ? 'bg-blue-900/50 text-blue-200 border-blue-700'
                      : 'bg-gray-950 text-gray-500 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-800 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            aria-expanded={showAdvanced}
          >
            <span className="inline-block w-3 text-xs">{showAdvanced ? '−' : '+'}</span>
            <span>Advanced filters</span>
            {advancedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/60 text-blue-200 border border-blue-800">
                {advancedCount} active
              </span>
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                    Safety
                    <InfoTooltip
                      position="bottom"
                      text="Filter by Global Peace Index 2025 threshold. Very safe = score ≤ 1.5 (top ~25 countries). Safe = ≤ 2.0. Moderate = ≤ 2.5."
                    />
                  </label>
                  <select
                    value={filters.safety}
                    onChange={(e) => setFilters((p) => ({ ...p, safety: e.target.value as SafetyThreshold }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {SAFETY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                    Retirement visa
                    <InfoTooltip
                      position="bottom"
                      text="How accessible a retirement / long-term residency visa is for US citizens. Easy = dedicated retirement visa with low income threshold (Portugal D7, Mexico TR, Costa Rica Pensionado). Up to medium adds moderate-threshold options. Up to hard excludes only the countries with no realistic retirement pathway."
                    />
                  </label>
                  <select
                    value={filters.visa}
                    onChange={(e) => setFilters((p) => ({ ...p, visa: e.target.value as VisaDifficulty | 'any' }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {VISA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                    English
                    <InfoTooltip
                      position="bottom"
                      text="How widely English is spoken locally. Widespread = near-universal among working-age in cities (Singapore, Netherlands, Malaysia). Urban areas = English common in tourist/expat zones (Portugal, Italy, Thailand). Limited = need to learn the local language."
                    />
                  </label>
                  <select
                    value={filters.english}
                    onChange={(e) => setFilters((p) => ({ ...p, english: e.target.value as EnglishLevel | 'any' }))}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {ENGLISH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  Dominant faith
                  <InfoTooltip
                    position="bottom"
                    text="Filter by the country's dominant religious tradition (cultural majority, not necessarily practicing). Select one or more chips to include those faiths. Leave all unselected to ignore this filter."
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_FAITHS.map((f) => {
                    const active = filters.faiths.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFaith(f)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          active
                            ? 'bg-purple-900/50 text-purple-200 border-purple-700'
                            : 'bg-gray-950 text-gray-500 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              {advancedCount > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={resetAdvanced}
                    className="text-xs text-gray-500 hover:text-gray-300 underline"
                  >
                    Reset advanced filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 border-t border-gray-800 pt-3">
          Safety data: Global Peace Index 2025 (
          <a href={safetySource.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">
            Wikipedia
          </a>
          ). Faith, visa difficulty, and English level are editorial classifications — see per-country notes for caveats.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white mb-4">
          Results <span className="text-sm text-gray-500 font-normal">({results.length} of {countries.length} countries)</span>
        </h2>
        {results.length === 0 ? (
          <div className="p-8 rounded-lg border border-gray-800 bg-gray-900/30 text-center text-gray-500">
            No countries match the current filters. Try widening the region selection or relaxing the safety threshold.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <SortableTh sortKey="country" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                    tooltip="Country name, 2-letter code, and region. Click to sort alphabetically.">
                    Country
                  </SortableTh>
                  <SortableTh sortKey="fireAge" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                    tooltip="The age at which you can stop working, assuming you relocate here. Equals current age + years to FIRE.">
                    FIRE age
                  </SortableTh>
                  <SortableTh sortKey="years" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                    tooltip="Years from today until your portfolio reaches the FIRE number, solved from compound growth: P(t) = currentSavings × (1+r)^t + annualSavings × ((1+r)^t − 1) / r.">
                    Years
                  </SortableTh>
                  <SortableTh sortKey="spend" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                    tooltip="Annual spending in USD localized to this country. Formula: (your US baseline spending × cost-of-living multiplier) + annual healthcare cost.">
                    Annual spend
                  </SortableTh>
                  <SortableTh sortKey="fireNumber" activeKey={sortKey} dir={sortDir} onClick={onSort} align="right"
                    tooltip="Portfolio size at which a 4% safe withdrawal rate covers your localized annual spend after tax. Formula: annual spend / (1 − tax rate) / SWR.">
                    FIRE number
                  </SortableTh>
                  <SortableTh sortKey="safety" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                    tooltip="Global Peace Index 2025 score. 1.0 = most peaceful, ~3.5 = least. Lower is safer. The GPI rank (out of 163 countries) is shown when you hover the badge in the row.">
                    Safety
                  </SortableTh>
                  <SortableTh sortKey="confidence" activeKey={sortKey} dir={sortDir} onClick={onSort} align="left"
                    tooltip="How well-supported the country's parameters are by public data. High = well-documented baseline (US). Medium = standard public sources cited. Low = limited public data or rapidly-changing tax/visa rules.">
                    Confidence
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => {
                  const c = countryById[r.countryId];
                  return (
                    <tr key={r.countryId} className="border-t border-gray-800 hover:bg-gray-900/40">
                      <td className="px-4 py-3 text-white">
                        <span className="font-medium">{c?.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{c?.flag}</span>
                        <div className="text-xs text-gray-600">{c?.region}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">
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

      {sortedResults.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Country notes</h2>
          {sortedResults.map((r) => {
            const c = countryById[r.countryId];
            if (!c) return null;
            return (
              <div key={c.id} className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
                <h3 className="font-semibold text-white mb-1">
                  {c.name} <span className="text-gray-500 text-sm">{c.flag} · {c.region}</span>
                </h3>
                <p className="text-sm text-gray-400 mb-2">{c.residencyNote}</p>
                {c.caveats.length > 0 && (
                  <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
                    {c.caveats.map((cav, i) => (
                      <li key={i}>{cav}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

interface SortableThProps {
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  tooltip: string;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

function SortableTh({
  sortKey,
  activeKey,
  dir,
  onClick,
  tooltip,
  align = 'left',
  children,
}: SortableThProps) {
  const active = sortKey === activeKey;
  const indicator = active ? (dir === 'asc' ? '↑' : '↓') : '↕';
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const justifyClass = align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <th className={`${alignClass} px-4 py-3 font-medium`}>
      <span className={`inline-flex items-center ${justifyClass} gap-1`}>
        <button
          type="button"
          onClick={() => onClick(sortKey)}
          className="inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          <span className={active ? 'text-white' : ''}>{children}</span>
          <span className={`text-[10px] ${active ? 'text-blue-400' : 'text-gray-700'}`}>{indicator}</span>
        </button>
        <InfoTooltip position="bottom" text={tooltip} />
      </span>
    </th>
  );
}

function NumberField({ label, value, onChange, step = 1, min, max }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}
