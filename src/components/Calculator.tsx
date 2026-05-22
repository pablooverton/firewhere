'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { computeAll, DEFAULT_TARGET_RETIREMENT_AGE, filterCountries } from '@/domain/fire';
import type { Country, DataSource, FilterCriteria, Mode, UserInputs } from '@/domain/types';
import { cmpNum, CONFIDENCE_ORDER } from '@/lib/format';
import {
  countActiveAdvancedFilters,
  decodeStateFromURL,
  defaultFilters,
  defaultInputs,
  encodeStateToURL,
} from '@/lib/url-state';
import { CountryNotes } from './CountryNotes';
import { FiltersPanel } from './FiltersPanel';
import { InputsPanel } from './InputsPanel';
import { ResultsTable, type SortKey } from './ResultsTable';
import type { SortDir } from './SortableTh';

interface Props {
  countries: Country[];
  dataSources: { safety: DataSource; costOfLiving: DataSource };
}

export function Calculator({ countries, dataSources }: Props) {
  const [inputs, setInputs] = useState<UserInputs>(defaultInputs);
  const [filters, setFilters] = useState<FilterCriteria>(defaultFilters);
  const [sortKey, setSortKey] = useState<SortKey>('fireAge');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mode, setMode] = useState<Mode>('fire');
  const [targetAge, setTargetAge] = useState<number>(DEFAULT_TARGET_RETIREMENT_AGE);
  const [copied, setCopied] = useState(false);
  const [prefilledFromLumpslam, setPrefilledFromLumpslam] = useState(false);

  // Load state from URL on mount (post-hydration). Static export means the initial render
  // has no access to window.location, so we hydrate state from the URL once on the client.
  /* eslint-disable react-hooks/set-state-in-effect */
  const didLoadFromURL = useRef(false);
  useEffect(() => {
    if (didLoadFromURL.current) return;
    didLoadFromURL.current = true;
    const decoded = decodeStateFromURL();
    if (!decoded) return;
    if (decoded.inputs) setInputs(decoded.inputs);
    if (decoded.filters) setFilters(decoded.filters);
    if (decoded.mode) setMode(decoded.mode);
    if (decoded.targetAge) setTargetAge(decoded.targetAge);
    if (decoded.filters && countActiveAdvancedFilters(decoded.filters) > 0) {
      setShowAdvanced(true);
    }
    if (decoded.source === 'lumpslam') setPrefilledFromLumpslam(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.setTimeout(() => {
      const params = encodeStateToURL(inputs, filters, mode, targetAge);
      const search = params.toString();
      const url = search.length > 0
        ? `${window.location.pathname}?${search}`
        : window.location.pathname;
      window.history.replaceState(null, '', url);
    }, 300);
    return () => window.clearTimeout(t);
  }, [inputs, filters, mode, targetAge]);

  const visibleCountries = useMemo(
    () => filterCountries(countries, filters),
    [countries, filters]
  );
  const results = useMemo(
    () => computeAll(inputs, visibleCountries, { mode, targetRetirementAge: targetAge }),
    [inputs, visibleCountries, mode, targetAge]
  );
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

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const copyLink = async () => {
    if (typeof window === 'undefined') return;
    const params = encodeStateToURL(inputs, filters, mode, targetAge);
    const search = params.toString();
    const url = search.length > 0
      ? `${window.location.origin}${window.location.pathname}?${search}`
      : `${window.location.origin}${window.location.pathname}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may fail (insecure context, permissions). Fall back to nothing.
    }
  };

  return (
    <div className="space-y-10">
      {prefilledFromLumpslam && (
        <div className="px-4 py-3 rounded-md border border-blue-700 bg-blue-950/40 text-sm text-blue-100">
          <strong className="text-blue-200">Inputs pre-filled from Lump Slam.</strong> Adjust as needed.{' '}
          <a
            href="https://www.pablooverton.com/lumpslam/profile/"
            className="text-blue-300 underline hover:text-blue-200"
          >
            ← back to Lump Slam
          </a>
        </div>
      )}
      <InputsPanel
        inputs={inputs}
        setInputs={setInputs}
        mode={mode}
        setMode={setMode}
        targetAge={targetAge}
        setTargetAge={setTargetAge}
        onCopyLink={copyLink}
        copied={copied}
      />
      <FiltersPanel
        filters={filters}
        setFilters={setFilters}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        safetySource={dataSources.safety}
      />
      <ResultsTable
        sortedResults={sortedResults}
        countryById={countryById}
        totalCountries={countries.length}
        visibleCount={results.length}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        mode={mode}
        targetAge={targetAge}
      />
      <CountryNotes sortedResults={sortedResults} countryById={countryById} mode={mode} inputs={inputs} />
    </div>
  );
}
