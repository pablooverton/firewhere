import { describe, it, expect } from 'vitest';
import {
  coastFireYears,
  computeAll,
  computeCountryFire,
  filterCountries,
  yearsToTarget,
} from '../src/domain/fire';
import {
  ALL_REGIONS,
  type Country,
  type FilterCriteria,
  type Region,
  type UserInputs,
} from '../src/domain/types';
import countriesData from '../src/data/countries.json';

const usCountry: Country = {
  id: 'us',
  name: 'United States',
  flag: 'US',
  region: 'Americas',
  colMultiplier: 1.0,
  annualHealthcareUSD: 12000,
  withdrawalTaxRate: 0.12,
  swr: 0.04,
  safetyScore: 2.443,
  safetyRank: 128,
  dominantFaith: 'Christian (mixed)',
  visaDifficulty: 'easy',
  englishLevel: 'widespread',
  yearsToCitizenship: 5,
  dualCitizenshipAllowed: true,
  foreignerPropertyOwnership: 'allowed',
  residencyNote: '',
  confidence: 'high',
  sources: [],
  caveats: [],
};

const defaultFilters: FilterCriteria = {
  regions: [],
  safety: 'any',
  faiths: [],
  visa: 'any',
  english: 'any',
  citizenship: 'any',
  property: 'any',
  requireDualCitizenship: false,
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

describe('coastFireYears', () => {
  it('returns 0 when already FIRE', () => {
    expect(coastFireYears(2_000_000, 0, 0.05, 40, 65, 1_500_000)).toBe(0);
  });

  it('returns 0 when current portfolio compounds to FIRE by target age without contributions', () => {
    // $500k at 5% real over 25 years = $1.69M, exceeds $1M target
    expect(coastFireYears(500_000, 10_000, 0.05, 40, 65, 1_000_000)).toBe(0);
  });

  it('CoastFIRE earlier than standard FIRE for same target', () => {
    // With 25-year coast window, CoastFIRE should be earlier than standard FIRE
    const fire = yearsToTarget(100_000, 30_000, 0.05, 1_500_000);
    const coast = coastFireYears(100_000, 30_000, 0.05, 40, 65, 1_500_000);
    expect(coast).toBeLessThan(fire);
  });

  it('returns Infinity when even maxed-out saving cannot reach target by retirement age', () => {
    // Save $10k/yr for 10 years at 5% to age 40 → can it grow to $10M by 65? No
    expect(coastFireYears(50_000, 10_000, 0.05, 40, 65, 10_000_000)).toBe(Infinity);
  });

  it('degenerates to standard FIRE when target retirement age ≤ current age', () => {
    const standardFire = yearsToTarget(100_000, 50_000, 0.05, 1_000_000);
    const coastNoBufferAge = coastFireYears(100_000, 50_000, 0.05, 65, 65, 1_000_000);
    const coastPastAge = coastFireYears(100_000, 50_000, 0.05, 70, 65, 1_000_000);
    expect(coastNoBufferAge).toBeCloseTo(standardFire, 6);
    expect(coastPastAge).toBeCloseTo(standardFire, 6);
  });

  it('degenerates to standard FIRE when realReturn ≤ 0 (no coast benefit)', () => {
    const standardFire = yearsToTarget(100_000, 50_000, 0, 800_000);
    const coast = coastFireYears(100_000, 50_000, 0, 40, 65, 800_000);
    expect(coast).toBeCloseTo(standardFire, 6);
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

  it('tax-free country (UAE) has lower FIRE number than taxed equivalent', () => {
    const taxFree: Country = { ...usCountry, id: 'tf', withdrawalTaxRate: 0 };
    const tfResult = computeCountryFire(baseUser, taxFree);
    const usResult = computeCountryFire(baseUser, usCountry);
    expect(tfResult.fireNumber).toBeLessThan(usResult.fireNumber);
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

  it('lowest-COL countries rank earlier than US baseline', () => {
    const user: UserInputs = {
      currentSavings: 200_000,
      annualSavings: 40_000,
      currentSpending: 50_000,
      currentAge: 35,
      realReturn: 0.05,
    };
    const results = computeAll(user, countriesData.countries as Country[]);
    const usIdx = results.findIndex((r) => r.countryId === 'us');
    // Vietnam (0.38) and Laos (0.35) are among the lowest-COL — both should rank earlier
    const vnIdx = results.findIndex((r) => r.countryId === 'vn');
    const laIdx = results.findIndex((r) => r.countryId === 'la');
    expect(vnIdx).toBeLessThan(usIdx);
    expect(laIdx).toBeLessThan(usIdx);
  });
});

describe('filterCountries', () => {
  const all = countriesData.countries as Country[];

  it('empty region list returns no region filter (matches all regions, modulo other filters)', () => {
    const filtered = filterCountries(all, { ...defaultFilters });
    expect(filtered).toHaveLength(all.length);
  });

  it('all-regions selection equals no filter', () => {
    const filtered = filterCountries(all, { ...defaultFilters, regions: [...ALL_REGIONS] });
    expect(filtered).toHaveLength(all.length);
  });

  it('single region filter keeps only that region', () => {
    const filtered = filterCountries(all, { ...defaultFilters, regions: ['Europe'] });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((c) => c.region === 'Europe')).toBe(true);
  });

  it('multi-region filter keeps any matching region', () => {
    const regions: Region[] = ['Americas', 'Europe'];
    const filtered = filterCountries(all, { ...defaultFilters, regions });
    expect(filtered.every((c) => regions.includes(c.region))).toBe(true);
  });

  it('very-safe threshold keeps only GPI ≤ 1.5', () => {
    const filtered = filterCountries(all, { ...defaultFilters, safety: 'very-safe' });
    expect(filtered.every((c) => c.safetyScore <= 1.5)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('safe threshold keeps only GPI ≤ 2.0', () => {
    const filtered = filterCountries(all, { ...defaultFilters, safety: 'safe' });
    expect(filtered.every((c) => c.safetyScore <= 2.0)).toBe(true);
  });

  it('moderate threshold keeps only GPI ≤ 2.5', () => {
    const filtered = filterCountries(all, { ...defaultFilters, safety: 'moderate' });
    expect(filtered.every((c) => c.safetyScore <= 2.5)).toBe(true);
  });

  it('region and safety filters compose with AND semantics', () => {
    const filtered = filterCountries(all, { ...defaultFilters, regions: ['Europe'], safety: 'very-safe' });
    expect(filtered.every((c) => c.region === 'Europe' && c.safetyScore <= 1.5)).toBe(true);
  });

  it('Iceland (rank 1) survives the very-safe Europe filter', () => {
    const filtered = filterCountries(all, { ...defaultFilters, regions: ['Europe'], safety: 'very-safe' });
    expect(filtered.some((c) => c.id === 'is')).toBe(true);
  });

  it('Mexico (rank 135) is excluded by the safe filter', () => {
    const filtered = filterCountries(all, { ...defaultFilters, safety: 'safe' });
    expect(filtered.some((c) => c.id === 'mx')).toBe(false);
  });

  it('faith filter keeps only countries with the selected faiths', () => {
    const filtered = filterCountries(all, { ...defaultFilters, faiths: ['Catholic'] });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((c) => c.dominantFaith === 'Catholic')).toBe(true);
  });

  it('multi-faith filter keeps any of the selected faiths', () => {
    const filtered = filterCountries(all, { ...defaultFilters, faiths: ['Catholic', 'Orthodox'] });
    expect(filtered.every((c) => c.dominantFaith === 'Catholic' || c.dominantFaith === 'Orthodox')).toBe(true);
  });

  it('visa=easy keeps only easy-retirement-visa countries', () => {
    const filtered = filterCountries(all, { ...defaultFilters, visa: 'easy' });
    expect(filtered.every((c) => c.visaDifficulty === 'easy')).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('visa=hard includes easy/medium/hard but excludes closed', () => {
    const filtered = filterCountries(all, { ...defaultFilters, visa: 'hard' });
    expect(filtered.every((c) => c.visaDifficulty !== 'closed')).toBe(true);
  });

  it('english=widespread keeps only widespread-English countries', () => {
    const filtered = filterCountries(all, { ...defaultFilters, english: 'widespread' });
    expect(filtered.every((c) => c.englishLevel === 'widespread')).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('english=urban keeps urban OR widespread (at-least semantics)', () => {
    const filtered = filterCountries(all, { ...defaultFilters, english: 'urban' });
    expect(filtered.every((c) => c.englishLevel === 'urban' || c.englishLevel === 'widespread')).toBe(true);
  });

  it('all filters compose: Catholic + Europe + easy visa + urban English', () => {
    const filtered = filterCountries(all, {
      ...defaultFilters,
      regions: ['Europe'],
      faiths: ['Catholic'],
      visa: 'easy',
      english: 'urban',
    });
    expect(filtered.every((c) =>
      c.region === 'Europe' &&
      c.dominantFaith === 'Catholic' &&
      c.visaDifficulty === 'easy' &&
      (c.englishLevel === 'urban' || c.englishLevel === 'widespread')
    )).toBe(true);
  });

  it('citizenship=5 keeps only countries with naturalization in ≤5 years', () => {
    const filtered = filterCountries(all, { ...defaultFilters, citizenship: '5' });
    expect(filtered.every((c) => c.yearsToCitizenship <= 5)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('citizenship=3 includes Argentina (2 yrs) and Ecuador / Canada (3 yrs)', () => {
    const filtered = filterCountries(all, { ...defaultFilters, citizenship: '3' });
    expect(filtered.some((c) => c.id === 'ar')).toBe(true);
    expect(filtered.some((c) => c.id === 'ca')).toBe(true);
  });

  it('property=allowed keeps only freehold-allowed countries', () => {
    const filtered = filterCountries(all, { ...defaultFilters, property: 'allowed' });
    expect(filtered.every((c) => c.foreignerPropertyOwnership === 'allowed')).toBe(true);
  });

  it('property=allowed excludes Thailand (leasehold-only) and New Zealand (closed)', () => {
    const filtered = filterCountries(all, { ...defaultFilters, property: 'allowed' });
    expect(filtered.some((c) => c.id === 'th')).toBe(false);
    expect(filtered.some((c) => c.id === 'nz')).toBe(false);
  });

  it('property=not-closed includes restricted and leasehold but excludes New Zealand', () => {
    const filtered = filterCountries(all, { ...defaultFilters, property: 'not-closed' });
    expect(filtered.some((c) => c.id === 'th')).toBe(true);
    expect(filtered.some((c) => c.id === 'nz')).toBe(false);
  });

  it('requireDualCitizenship excludes countries that require US renunciation', () => {
    const filtered = filterCountries(all, { ...defaultFilters, requireDualCitizenship: true });
    expect(filtered.every((c) => c.dualCitizenshipAllowed)).toBe(true);
    // Japan, Korea, Singapore should be excluded
    expect(filtered.some((c) => c.id === 'jp')).toBe(false);
    expect(filtered.some((c) => c.id === 'kr')).toBe(false);
    expect(filtered.some((c) => c.id === 'sg')).toBe(false);
  });
});

describe('countries.json integrity', () => {
  it('every country has all required fields with sane bounds', () => {
    for (const c of countriesData.countries) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(ALL_REGIONS).toContain(c.region as Region);
      expect(c.colMultiplier).toBeGreaterThan(0);
      expect(c.colMultiplier).toBeLessThan(3);
      expect(c.annualHealthcareUSD).toBeGreaterThanOrEqual(0);
      expect(c.withdrawalTaxRate).toBeGreaterThanOrEqual(0);
      expect(c.withdrawalTaxRate).toBeLessThan(1);
      expect(c.swr).toBeGreaterThan(0);
      expect(c.swr).toBeLessThan(0.1);
      expect(c.safetyScore).toBeGreaterThan(0);
      expect(c.safetyScore).toBeLessThan(5);
      expect(c.safetyRank).toBeGreaterThan(0);
      expect(c.safetyRank).toBeLessThan(200);
      expect(['high', 'medium', 'low']).toContain(c.confidence);
      expect(Array.isArray(c.sources)).toBe(true);
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.dominantFaith).toBeTruthy();
      expect(['easy', 'medium', 'hard', 'closed']).toContain(c.visaDifficulty);
      expect(['widespread', 'urban', 'limited']).toContain(c.englishLevel);
      expect(typeof c.yearsToCitizenship).toBe('number');
      expect(c.yearsToCitizenship).toBeGreaterThanOrEqual(0);
      expect(c.yearsToCitizenship).toBeLessThanOrEqual(50);
      expect(typeof c.dualCitizenshipAllowed).toBe('boolean');
      expect(['allowed', 'restricted', 'leasehold-only', 'closed']).toContain(c.foreignerPropertyOwnership);
    }
  });

  it('country IDs are unique', () => {
    const ids = countriesData.countries.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every region is represented by at least one country', () => {
    const regions = new Set(countriesData.countries.map((c) => c.region));
    for (const r of ALL_REGIONS) {
      expect(regions.has(r)).toBe(true);
    }
  });

  it('dataSources points to wikipedia + numbeo with valid URLs', () => {
    expect(countriesData.dataSources.safety.url).toMatch(/^https:\/\/en\.wikipedia\.org\//);
    expect(countriesData.dataSources.costOfLiving.url).toMatch(/^https:\/\/(www\.)?numbeo\.com\//);
  });

  it('dataset includes at least 45 countries (top-50 scale)', () => {
    expect(countriesData.countries.length).toBeGreaterThanOrEqual(45);
  });

  it('safety ranks are consistent: lower rank means lower score', () => {
    // GPI score and rank should correlate strongly. Sample a few high/low pairs.
    const byRank = [...countriesData.countries].sort((a, b) => a.safetyRank - b.safetyRank);
    expect(byRank[0].safetyScore).toBeLessThan(byRank[byRank.length - 1].safetyScore);
  });
});
