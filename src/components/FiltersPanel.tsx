'use client';

import {
  ALL_FAITHS,
  ALL_REGIONS,
  CITIZENSHIP_OPTIONS,
  type CitizenshipThreshold,
  type DataSource,
  type EnglishLevel,
  type Faith,
  type FilterCriteria,
  PROPERTY_OPTIONS,
  type Region,
  type SafetyThreshold,
  type VisaDifficulty,
  VISA_OPTIONS,
} from '@/domain/types';
import { countActiveAdvancedFilters } from '@/lib/url-state';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  filters: FilterCriteria;
  setFilters: (updater: (prev: FilterCriteria) => FilterCriteria) => void;
  showAdvanced: boolean;
  setShowAdvanced: (updater: (prev: boolean) => boolean) => void;
  safetySource: DataSource;
}

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

export function FiltersPanel({ filters, setFilters, showAdvanced, setShowAdvanced, safetySource }: Props) {
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
      citizenship: 'any',
      property: 'any',
      requireDualCitizenship: false,
    }));
  };

  const advancedCount = countActiveAdvancedFilters(filters);

  return (
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  Citizenship pathway
                  <InfoTooltip
                    position="bottom"
                    text="Standard residency-based naturalization for a US citizen with no heritage / fast-track. Argentina (2 yrs), Ecuador / Canada (3 yrs), Australia (4 yrs) are at the fast end. Switzerland, Austria, Italy, Spain are 10+ yrs."
                  />
                </label>
                <select
                  value={filters.citizenship}
                  onChange={(e) => setFilters((p) => ({ ...p, citizenship: e.target.value as CitizenshipThreshold }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {CITIZENSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  Property ownership
                  <InfoTooltip
                    position="bottom"
                    text="How foreign residential property purchase works. Freehold = full ownership (most of EU + Americas + Korea/Japan/Taiwan). Foreigners can buy = includes restricted zones (Mexico Restricted Zone, UAE freehold zones, Singapore private only) and leasehold-only (Thailand 30-yr renewable, Vietnam 50-yr). New Zealand is closed to foreigners since 2018."
                  />
                </label>
                <select
                  value={filters.property}
                  onChange={(e) => setFilters((p) => ({ ...p, property: e.target.value as FilterCriteria['property'] }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {PROPERTY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  Dual citizenship with US
                  <InfoTooltip
                    position="bottom"
                    text="Some countries require renouncing US citizenship to naturalize: Japan, South Korea, Singapore, Netherlands (with exceptions), Austria (with exceptions), Spain (for non-Iberian), UAE. Check this box to exclude them."
                  />
                </label>
                <label className="flex items-center gap-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={filters.requireDualCitizenship}
                    onChange={(e) => setFilters((p) => ({ ...p, requireDualCitizenship: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 accent-blue-600"
                  />
                  <span className="text-sm text-gray-300">Must allow dual citizenship</span>
                </label>
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
  );
}
