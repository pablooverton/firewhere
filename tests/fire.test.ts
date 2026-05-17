import { describe, it, expect } from 'vitest';
import { computeCountryFire, computeAll, yearsToTarget } from '../src/domain/fire';
import type { Country, UserInputs } from '../src/domain/types';
import countriesData from '../src/data/countries.json';

const usCountry: Country = {
  id: 'us',
  name: 'United States',
  flag: 'US',
  colMultiplier: 1.0,
  annualHealthcareUSD: 12000,
  withdrawalTaxRate: 0.12,
  swr: 0.04,
  residencyNote: '',
  confidence: 'high',
  sources: [],
  caveats: [],
};

describe('yearsToTarget', () => {
  it('returns 0 when current savings already exceed target', () => {
    expect(yearsToTarget(150_000, 10_000, 0.05, 100_000)).toBe(0);
  });

  it('returns 0 when current savings exactly equal target', () => {
    expect(yearsToTarget(100_000, 10_000, 0.05, 100_000)).toBe(0);
  });

  it('linear case (zero return) divides shortfall by annual savings', () => {
    expect(yearsToTarget(0, 10_000, 0, 100_000)).toBe(10);
  });

  it('rule-of-72 sanity: $100k at 7.2% real ≈ 10 years to $200k with no contributions', () => {
    const years = yearsToTarget(100_000, 0, 0.072, 200_000);
    expect(years).toBeGreaterThan(9.5);
    expect(years).toBeLessThan(10.5);
  });

  it('round-trip: contributions-only future value solves back to the original horizon', () => {
    const r = 0.07;
    const annual = 10_000;
    const horizon = 10;
    const fv = annual * ((Math.pow(1 + r, horizon) - 1) / r);
    const solved = yearsToTarget(0, annual, r, fv);
    expect(solved).toBeCloseTo(horizon, 4);
  });

  it('returns Infinity when contributions are zero and return is zero', () => {
    expect(yearsToTarget(50_000, 0, 0, 100_000)).toBe(Infinity);
  });

  it('returns Infinity when contributions cannot overcome negative drift', () => {
    expect(yearsToTarget(100_000, 1_000, -0.05, 10_000_000)).toBe(Infinity);
  });
});

describe('computeCountryFire', () => {
  const baseUser: UserInputs = {
    currentSavings: 500_000,
    annualSavings: 50_000,
    currentSpending: 60_000,
    currentAge: 40,
    realReturn: 0.05,
  };

  it('localized spending = spending * COL + healthcare', () => {
    const result = computeCountryFire(baseUser, usCountry);
    expect(result.localizedSpending).toBe(60_000 * 1.0 + 12_000);
  });

  it('pre-tax withdrawal grosses up for withdrawal tax', () => {
    const result = computeCountryFire(baseUser, usCountry);
    expect(result.preTaxWithdrawalNeeded).toBeCloseTo(72_000 / 0.88, 2);
  });

  it('fire number = pre-tax withdrawal / SWR', () => {
    const result = computeCountryFire(baseUser, usCountry);
    expect(result.fireNumber).toBeCloseTo(result.preTaxWithdrawalNeeded / 0.04, 2);
  });

  it('lower COL country reaches FIRE earlier than higher COL', () => {
    const lowCol: Country = { ...usCountry, id: 'low', colMultiplier: 0.5, annualHealthcareUSD: 2000 };
    const lowResult = computeCountryFire(baseUser, lowCol);
    const usResult = computeCountryFire(baseUser, usCountry);
    expect(lowResult.fireAge).toBeLessThan(usResult.fireAge);
  });

  it('already-FIRE user is flagged correctly', () => {
    const richUser: UserInputs = { ...baseUser, currentSavings: 5_000_000 };
    const result = computeCountryFire(richUser, usCountry);
    expect(result.alreadyFire).toBe(true);
    expect(result.yearsToFire).toBe(0);
    expect(result.fireAge).toBe(richUser.currentAge);
  });

  it('confidence flag is propagated from country to result', () => {
    const medCountry: Country = { ...usCountry, confidence: 'medium' };
    const result = computeCountryFire(baseUser, medCountry);
    expect(result.confidence).toBe('medium');
  });
});

describe('computeAll', () => {
  it('returns one result per country, sorted by FIRE age ascending', () => {
    const user: UserInputs = {
      currentSavings: 200_000,
      annualSavings: 40_000,
      currentSpending: 50_000,
      currentAge: 35,
      realReturn: 0.05,
    };
    const results = computeAll(user, countriesData.countries as Country[]);
    expect(results).toHaveLength(countriesData.countries.length);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].fireAge).toBeGreaterThanOrEqual(results[i - 1].fireAge);
    }
  });

  it('Taiwan (lowest COL in dataset) ranks earlier than US baseline', () => {
    const user: UserInputs = {
      currentSavings: 200_000,
      annualSavings: 40_000,
      currentSpending: 50_000,
      currentAge: 35,
      realReturn: 0.05,
    };
    const results = computeAll(user, countriesData.countries as Country[]);
    const usIdx = results.findIndex((r) => r.countryId === 'us');
    const twIdx = results.findIndex((r) => r.countryId === 'tw');
    expect(twIdx).toBeLessThan(usIdx);
  });
});

describe('countries.json integrity', () => {
  it('every country has all required fields with sane bounds', () => {
    for (const c of countriesData.countries) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.colMultiplier).toBeGreaterThan(0);
      expect(c.colMultiplier).toBeLessThan(3);
      expect(c.annualHealthcareUSD).toBeGreaterThanOrEqual(0);
      expect(c.withdrawalTaxRate).toBeGreaterThanOrEqual(0);
      expect(c.withdrawalTaxRate).toBeLessThan(1);
      expect(c.swr).toBeGreaterThan(0);
      expect(c.swr).toBeLessThan(0.1);
      expect(['high', 'medium', 'low']).toContain(c.confidence);
      expect(Array.isArray(c.sources)).toBe(true);
      expect(c.sources.length).toBeGreaterThan(0);
    }
  });

  it('country IDs are unique', () => {
    const ids = countriesData.countries.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
