import { DEFAULT_TARGET_RETIREMENT_AGE } from '@/domain/fire';
import {
  ALL_FAITHS,
  ALL_REGIONS,
  type CitizenshipThreshold,
  type EnglishLevel,
  type Faith,
  type FilterCriteria,
  type Mode,
  type Region,
  type SafetyThreshold,
  type UserInputs,
  type VisaDifficulty,
} from '@/domain/types';

export const defaultInputs: UserInputs = {
  currentSavings: 250_000,
  annualSavings: 40_000,
  currentSpending: 60_000,
  currentAge: 40,
  realReturn: 0.05,
};

export const defaultFilters: FilterCriteria = {
  regions: [...ALL_REGIONS],
  safety: 'any',
  faiths: [],
  visa: 'any',
  english: 'any',
  citizenship: 'any',
  property: 'any',
  requireDualCitizenship: false,
};

export function countActiveAdvancedFilters(f: FilterCriteria): number {
  let n = 0;
  if (f.safety !== 'any') n++;
  if (f.faiths.length > 0) n++;
  if (f.visa !== 'any') n++;
  if (f.english !== 'any') n++;
  if (f.citizenship !== 'any') n++;
  if (f.property !== 'any') n++;
  if (f.requireDualCitizenship) n++;
  return n;
}

export function encodeStateToURL(
  inputs: UserInputs,
  filters: FilterCriteria,
  mode: Mode,
  targetAge: number
): URLSearchParams {
  const p = new URLSearchParams();
  if (inputs.currentSavings !== defaultInputs.currentSavings) p.set('s', String(inputs.currentSavings));
  if (inputs.annualSavings !== defaultInputs.annualSavings) p.set('as', String(inputs.annualSavings));
  if (inputs.currentSpending !== defaultInputs.currentSpending) p.set('sp', String(inputs.currentSpending));
  if (inputs.currentAge !== defaultInputs.currentAge) p.set('age', String(inputs.currentAge));
  if (inputs.realReturn !== defaultInputs.realReturn) p.set('r', String(inputs.realReturn));
  if (mode !== 'fire') p.set('mode', mode);
  if (mode === 'coast' && targetAge !== DEFAULT_TARGET_RETIREMENT_AGE) p.set('target', String(targetAge));
  if (filters.regions.length !== ALL_REGIONS.length) p.set('regions', filters.regions.join(','));
  if (filters.safety !== 'any') p.set('safety', filters.safety);
  if (filters.faiths.length > 0) p.set('faiths', filters.faiths.join(','));
  if (filters.visa !== 'any') p.set('visa', filters.visa);
  if (filters.english !== 'any') p.set('en', filters.english);
  if (filters.citizenship !== 'any') p.set('cit', filters.citizenship);
  if (filters.property !== 'any') p.set('prop', filters.property);
  if (filters.requireDualCitizenship) p.set('dual', '1');
  return p;
}

export interface DecodedState {
  inputs: UserInputs;
  filters: FilterCriteria;
  mode: Mode;
  targetAge: number;
}

export function decodeStateFromURL(): Partial<DecodedState> | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  if (p.toString().length === 0) return null;
  const num = (k: string, fallback: number): number => {
    const v = Number(p.get(k));
    return Number.isFinite(v) ? v : fallback;
  };
  const inputs: UserInputs = {
    currentSavings: num('s', defaultInputs.currentSavings),
    annualSavings: num('as', defaultInputs.annualSavings),
    currentSpending: num('sp', defaultInputs.currentSpending),
    currentAge: num('age', defaultInputs.currentAge),
    realReturn: num('r', defaultInputs.realReturn),
  };
  const mode: Mode = p.get('mode') === 'coast' ? 'coast' : 'fire';
  const targetAge = num('target', DEFAULT_TARGET_RETIREMENT_AGE);
  const filters: FilterCriteria = {
    regions: p.has('regions')
      ? (p.get('regions') ?? '').split(',').filter((r): r is Region => ALL_REGIONS.includes(r as Region))
      : [...ALL_REGIONS],
    safety: (p.get('safety') as SafetyThreshold) ?? 'any',
    faiths: p.has('faiths')
      ? (p.get('faiths') ?? '').split(',').filter((f): f is Faith => ALL_FAITHS.includes(f as Faith))
      : [],
    visa: (p.get('visa') as VisaDifficulty | 'any') ?? 'any',
    english: (p.get('en') as EnglishLevel | 'any') ?? 'any',
    citizenship: (p.get('cit') as CitizenshipThreshold) ?? 'any',
    property: (p.get('prop') as FilterCriteria['property']) ?? 'any',
    requireDualCitizenship: p.get('dual') === '1',
  };
  return { inputs, filters, mode, targetAge };
}
