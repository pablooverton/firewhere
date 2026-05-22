import { describe, it, expect } from 'vitest';
import {
  annualHealthcareCost,
  bracketEffectiveRate,
  bracketTax,
  bridgeYears,
  BRIDGE_THRESHOLD_YEARS,
  coastFireYears,
  computeAll,
  computeCountryFire,
  filterCountries,
  hasLongBridge,
  SOCIAL_SECURITY_EARLIEST_AGE,
  solveIncomeScaledPremium,
  yearsToTarget,
} from '../src/domain/fire';
import {
  ALL_REGIONS,
  type Country,
  type FilterCriteria,
  type PremiumModel,
  type Region,
  type TaxBracket,
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
  currencyCode: 'USD',
  currencyVolatilityPct: 0,
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

describe('annualHealthcareCost', () => {
  const flatCountry: Country = { ...usCountry };
  const scaledCountry: Country = {
    ...usCountry,
    id: 'scaled',
    premiumModel: { type: 'income-scaled', rate: 0.08, minUSD: 2000, maxUSD: 6000 },
  };

  it('returns flat annualHealthcareUSD when no premiumModel present', () => {
    expect(annualHealthcareCost(flatCountry, 50_000)).toBe(flatCountry.annualHealthcareUSD);
    expect(annualHealthcareCost(flatCountry, 200_000)).toBe(flatCountry.annualHealthcareUSD);
  });

  it('returns minUSD when rate*income is below the floor', () => {
    expect(annualHealthcareCost(scaledCountry, 10_000)).toBe(2000); // 800 < 2000
    expect(annualHealthcareCost(scaledCountry, 24_000)).toBe(2000); // 1920 < 2000
  });

  it('returns rate*income in the interior region', () => {
    expect(annualHealthcareCost(scaledCountry, 50_000)).toBe(4000); // 0.08 * 50k = 4k
  });

  it('returns maxUSD when rate*income exceeds the ceiling', () => {
    expect(annualHealthcareCost(scaledCountry, 100_000)).toBe(6000); // 8000 > 6000
    expect(annualHealthcareCost(scaledCountry, 250_000)).toBe(6000);
  });

  it('is monotonically non-decreasing in income', () => {
    let prev = -1;
    for (let income = 0; income <= 200_000; income += 5_000) {
      const cost = annualHealthcareCost(scaledCountry, income);
      expect(cost).toBeGreaterThanOrEqual(prev);
      prev = cost;
    }
  });
});

describe('solveIncomeScaledPremium', () => {
  const model: PremiumModel = { type: 'income-scaled', rate: 0.08, minUSD: 2000, maxUSD: 6000 };

  it('interior solution: premium = rate * preTax and preTax satisfies the joint equation', () => {
    // baselineSpend=50k, COL=0.9, tax=0.08, rate=0.08 → denom = 1 - 0.08 - 0.08 = 0.84
    // preTax = 50_000 * 0.9 / 0.84 = 53_571.43
    // premium = 0.08 * 53_571.43 = 4_285.71 (interior: between 2000 and 6000)
    const r = solveIncomeScaledPremium(50_000, 0.9, 0.08, model);
    expect(r.preTax).toBeCloseTo(53_571.43, 1);
    expect(r.premium).toBeCloseTo(4_285.71, 1);
    // Verify the joint equation: preTax = (sc + premium) / (1 - tax)
    expect(r.preTax).toBeCloseTo((50_000 * 0.9 + r.premium) / (1 - 0.08), 4);
    // And: premium = rate * preTax
    expect(r.premium).toBeCloseTo(model.rate * r.preTax, 4);
  });

  it('floor solution when interior premium would fall below minUSD', () => {
    // baselineSpend=10k → interior premium = 0.08 * 10_000 * 0.9 / 0.84 = 857 < 2000 floor
    // Floor branch: preTax = (10_000 * 0.9 + 2000) / 0.92 = 11_000 / 0.92 = 11_956.52
    const r = solveIncomeScaledPremium(10_000, 0.9, 0.08, model);
    expect(r.premium).toBe(2000);
    expect(r.preTax).toBeCloseTo(11_956.52, 1);
  });

  it('ceiling solution when interior premium would exceed maxUSD', () => {
    // baselineSpend=150k → interior premium = 0.08 * 150_000 * 0.9 / 0.84 = 12_857 > 6000 cap
    // Ceiling branch: preTax = (150_000 * 0.9 + 6000) / 0.92 = 141_000 / 0.92 = 153_260.87
    const r = solveIncomeScaledPremium(150_000, 0.9, 0.08, model);
    expect(r.premium).toBe(6000);
    expect(r.preTax).toBeCloseTo(153_260.87, 1);
  });

  it('returns ceiling defensively when tax + rate >= 100% (interior undefined)', () => {
    const degenerate: PremiumModel = { type: 'income-scaled', rate: 0.6, minUSD: 1000, maxUSD: 5000 };
    const r = solveIncomeScaledPremium(50_000, 1.0, 0.5, degenerate);
    expect(r.premium).toBe(5000);
    expect(r.preTax).toBeCloseTo((50_000 + 5000) / 0.5, 4);
  });

  it('preTax is continuous at the floor/interior boundary', () => {
    // At the boundary, interior premium = minUSD; both branches return the same preTax.
    // 0.08 * (S * 0.9) / 0.84 = 2000 → S = 2000 * 0.84 / (0.08 * 0.9) = 23_333.33
    const boundarySpend = (model.minUSD * (1 - 0.08 - 0.08)) / (model.rate * 0.9);
    const epsilon = 0.001;
    const justBelow = solveIncomeScaledPremium(boundarySpend - epsilon, 0.9, 0.08, model);
    const justAbove = solveIncomeScaledPremium(boundarySpend + epsilon, 0.9, 0.08, model);
    // The function should be continuous: a tiny perturbation should produce a tiny output change.
    expect(Math.abs(justBelow.preTax - justAbove.preTax)).toBeLessThan(0.01);
    expect(Math.abs(justBelow.premium - justAbove.premium)).toBeLessThan(0.01);
  });

  it('preTax is continuous at the interior/ceiling boundary', () => {
    // 0.08 * (S * 0.9) / 0.84 = 6000 → S = 6000 * 0.84 / 0.072 = 70_000
    const boundarySpend = (model.maxUSD * (1 - 0.08 - 0.08)) / (model.rate * 0.9);
    const epsilon = 0.001;
    const justBelow = solveIncomeScaledPremium(boundarySpend - epsilon, 0.9, 0.08, model);
    const justAbove = solveIncomeScaledPremium(boundarySpend + epsilon, 0.9, 0.08, model);
    expect(Math.abs(justBelow.preTax - justAbove.preTax)).toBeLessThan(0.01);
    expect(Math.abs(justBelow.premium - justAbove.premium)).toBeLessThan(0.01);
  });
});

describe('computeCountryFire with income-scaled premium', () => {
  const baseUser: UserInputs = {
    currentSavings: 0,
    annualSavings: 50_000,
    currentSpending: 50_000,
    currentAge: 40,
    realReturn: 0.05,
  };
  const koreaIdx = countriesData.countries.findIndex((c) => c.id === 'kr');
  const korea = countriesData.countries[koreaIdx] as Country;
  const japanIdx = countriesData.countries.findIndex((c) => c.id === 'jp');
  const japan = countriesData.countries[japanIdx] as Country;

  it('Korea entry has an income-scaled premium model', () => {
    expect(korea.premiumModel).toBeDefined();
    expect(korea.premiumModel?.type).toBe('income-scaled');
  });

  it('Japan entry has an income-scaled premium model', () => {
    expect(japan.premiumModel).toBeDefined();
    expect(japan.premiumModel?.type).toBe('income-scaled');
  });

  it('Korea FIRE result exposes the actual scaled premium, not the flat fallback', () => {
    const r = computeCountryFire(baseUser, korea);
    expect(r.premiumScales).toBe(true);
    expect(r.bracketTax).toBe(true);
    // With Korea brackets + NHIS scaling at $50k baseline, the joint solver
    // converges to preTax ≈ $61.8k and premium ≈ $5066. Premium is interior
    // (above the $2400 floor, below the $7500 ceiling).
    expect(r.annualHealthcareUSD).toBeGreaterThan(korea.premiumModel!.minUSD);
    expect(r.annualHealthcareUSD).toBeLessThan(korea.premiumModel!.maxUSD);
    expect(r.annualHealthcareUSD).toBeGreaterThan(4_500);
    expect(r.annualHealthcareUSD).toBeLessThan(5_500);
  });

  it('low-spending user hits Korea NHIS floor', () => {
    const lowSpender: UserInputs = { ...baseUser, currentSpending: 12_000 };
    const r = computeCountryFire(lowSpender, korea);
    expect(r.annualHealthcareUSD).toBe(korea.premiumModel!.minUSD);
  });

  it('high-spending user hits Korea NHIS ceiling', () => {
    const highSpender: UserInputs = { ...baseUser, currentSpending: 120_000 };
    const r = computeCountryFire(highSpender, korea);
    expect(r.annualHealthcareUSD).toBe(korea.premiumModel!.maxUSD);
  });

  it('Korea FIRE number rises monotonically with spending under the scaled model', () => {
    const spends = [20_000, 40_000, 60_000, 80_000, 100_000];
    const fires = spends.map((s) => computeCountryFire({ ...baseUser, currentSpending: s }, korea).fireNumber);
    for (let i = 1; i < fires.length; i++) {
      expect(fires[i]).toBeGreaterThan(fires[i - 1]);
    }
  });

  it('flat countries are unaffected by the premium model logic', () => {
    const portugalIdx = countriesData.countries.findIndex((c) => c.id === 'pt');
    const pt = countriesData.countries[portugalIdx] as Country;
    expect(pt.premiumModel).toBeUndefined();
    const r = computeCountryFire(baseUser, pt);
    expect(r.premiumScales).toBe(false);
    expect(r.annualHealthcareUSD).toBe(pt.annualHealthcareUSD);
  });

  it('localizedSpending equals baselineSpend*COL + scaledPremium', () => {
    const r = computeCountryFire(baseUser, korea);
    const expected = baseUser.currentSpending * korea.colMultiplier + r.annualHealthcareUSD;
    expect(r.localizedSpending).toBeCloseTo(expected, 4);
  });

  it('preTax = localizedSpending / (1 - effectiveTaxRate) holds for the scaled case', () => {
    const r = computeCountryFire(baseUser, korea);
    // With brackets, the relation uses the bracket-derived effective rate exposed on the result.
    expect(r.preTaxWithdrawalNeeded).toBeCloseTo(r.localizedSpending / (1 - r.effectiveTaxRate), 2);
  });
});

describe('bracketTax', () => {
  // US 2025 federal single brackets, used as the standard test fixture
  const usBrackets: TaxBracket[] = [
    { thresholdUSD: 0, rate: 0.1 },
    { thresholdUSD: 11925, rate: 0.12 },
    { thresholdUSD: 48475, rate: 0.22 },
    { thresholdUSD: 103350, rate: 0.24 },
    { thresholdUSD: 197300, rate: 0.32 },
    { thresholdUSD: 250525, rate: 0.35 },
    { thresholdUSD: 626350, rate: 0.37 },
  ];
  const usAllowance = 15000;

  it('returns 0 for zero income', () => {
    expect(bracketTax(0, usBrackets, usAllowance)).toBe(0);
  });

  it('returns 0 when income is at or below the allowance', () => {
    expect(bracketTax(15000, usBrackets, usAllowance)).toBe(0);
    expect(bracketTax(10000, usBrackets, usAllowance)).toBe(0);
  });

  it('returns 0 when there are no brackets', () => {
    expect(bracketTax(50000, [], 0)).toBe(0);
  });

  it('first-bracket-only income taxed at first rate', () => {
    // Income = $20k, allowance = $15k → taxable = $5k, all in 10% bracket
    expect(bracketTax(20000, usBrackets, usAllowance)).toBeCloseTo(500, 4);
  });

  it('multi-bracket income sums each bracket portion', () => {
    // Income = $50k, allowance = $15k → taxable = $35k
    // Bracket 1: $0-$11925 at 10% = $1192.50
    // Bracket 2: $11925-$35000 at 12% = $2769
    // Total: $3961.50, effective on $50k ≈ 7.92%
    expect(bracketTax(50000, usBrackets, usAllowance)).toBeCloseTo(3961.5, 1);
  });

  it('top-bracket income applies the top rate to all income above the top threshold', () => {
    // Income = $1M, allowance = $15k → taxable = $985k
    // Through bracket 7 boundary at $626350: cumulative tax through prior brackets
    // Brackets 1-6: $1192.50 + ($48475-$11925)*0.12 + ($103350-$48475)*0.22 + ($197300-$103350)*0.24 +
    //               ($250525-$197300)*0.32 + ($626350-$250525)*0.35
    //             = 1192.5 + 4386 + 12072.5 + 22548 + 17032 + 131538.75 = 188769.75
    // Top bracket: ($985000 - $626350) * 0.37 = $358650 * 0.37 = $132700.5
    // Total ≈ $321470.25
    expect(bracketTax(1_000_000, usBrackets, usAllowance)).toBeCloseTo(321470.25, 0);
  });

  it('income exactly at a bracket boundary taxes nothing in the next bracket', () => {
    // Income = $63475 ($48475 taxable + $15k allowance) → exactly at end of 12% bracket
    // Bracket 1: $11925 * 0.10 = $1192.50
    // Bracket 2: ($48475 - $11925) * 0.12 = $36550 * 0.12 = $4386
    // Total: $5578.50; nothing in 22% bracket
    expect(bracketTax(63475, usBrackets, usAllowance)).toBeCloseTo(5578.5, 1);
  });

  it('handles allowance = 0 correctly', () => {
    // No allowance, $20k income, $20k taxable
    // Bracket 1: $11925 * 0.10 = $1192.50
    // Bracket 2: ($20000 - $11925) * 0.12 = $969
    // Total: $2161.50
    expect(bracketTax(20000, usBrackets, 0)).toBeCloseTo(2161.5, 1);
  });
});

describe('bracketEffectiveRate', () => {
  const flat20: TaxBracket[] = [{ thresholdUSD: 0, rate: 0.2 }];

  it('returns 0 for zero income', () => {
    expect(bracketEffectiveRate(0, flat20, 0)).toBe(0);
  });

  it('flat single-bracket schedule produces the same effective rate at any income', () => {
    expect(bracketEffectiveRate(10000, flat20, 0)).toBeCloseTo(0.2, 6);
    expect(bracketEffectiveRate(100000, flat20, 0)).toBeCloseTo(0.2, 6);
    expect(bracketEffectiveRate(1_000_000, flat20, 0)).toBeCloseTo(0.2, 6);
  });

  it('progressive schedule produces monotonically rising effective rate', () => {
    const brackets: TaxBracket[] = [
      { thresholdUSD: 0, rate: 0.1 },
      { thresholdUSD: 50000, rate: 0.3 },
      { thresholdUSD: 200000, rate: 0.45 },
    ];
    const rates = [25000, 50000, 100000, 200000, 500000, 1_000_000].map((x) => bracketEffectiveRate(x, brackets, 0));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });

  it('approaches the top rate as income → ∞', () => {
    const brackets: TaxBracket[] = [
      { thresholdUSD: 0, rate: 0.1 },
      { thresholdUSD: 100000, rate: 0.5 },
    ];
    const rate10x = bracketEffectiveRate(1_000_000, brackets, 0);
    const rate100x = bracketEffectiveRate(10_000_000, brackets, 0);
    expect(rate10x).toBeGreaterThan(0.4);
    expect(rate100x).toBeGreaterThan(rate10x);
    expect(rate100x).toBeLessThan(0.5);
  });
});

describe('computeCountryFire with bracket tax', () => {
  const baseUser: UserInputs = {
    currentSavings: 0,
    annualSavings: 50_000,
    currentSpending: 50_000,
    currentAge: 40,
    realReturn: 0.05,
  };
  const us = countriesData.countries.find((c) => c.id === 'us') as Country;
  const pt = countriesData.countries.find((c) => c.id === 'pt') as Country;
  const fr = countriesData.countries.find((c) => c.id === 'fr') as Country;
  const mx = countriesData.countries.find((c) => c.id === 'mx') as Country;

  it('US uses bracket tax with the standard deduction', () => {
    const r = computeCountryFire(baseUser, us);
    expect(r.bracketTax).toBe(true);
    // Effective at $50k spending baseline is well below the top bracket
    expect(r.effectiveTaxRate).toBeGreaterThan(0.05);
    expect(r.effectiveTaxRate).toBeLessThan(0.15);
  });

  it('US effective rate is roughly the flat fallback for moderate retirees', () => {
    const r = computeCountryFire(baseUser, us);
    // Calibration check: the flat fallback (0.08) should be within ~3pp of the bracket-derived rate at $50k
    expect(Math.abs(r.effectiveTaxRate - us.withdrawalTaxRate)).toBeLessThan(0.03);
  });

  it('Portugal post-NHR bracket tax produces a much higher FIRE number than the legacy flat 0.10', () => {
    const r = computeCountryFire(baseUser, pt);
    expect(r.bracketTax).toBe(true);
    // PT post-NHR is significantly more expensive than the legacy NHR 10% suggested
    expect(r.effectiveTaxRate).toBeGreaterThan(0.2);
  });

  it('France low brackets at moderate income approach the legacy flat 0.15', () => {
    const r = computeCountryFire(baseUser, fr);
    expect(r.bracketTax).toBe(true);
    expect(Math.abs(r.effectiveTaxRate - 0.15)).toBeLessThan(0.05);
  });

  it('higher spending pushes the effective bracket rate up monotonically', () => {
    const spends = [20_000, 50_000, 100_000, 200_000];
    const rates = spends.map((s) => computeCountryFire({ ...baseUser, currentSpending: s }, us).effectiveTaxRate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });

  it('FIRE number rises monotonically with spending under bracket tax', () => {
    const spends = [20_000, 50_000, 100_000, 200_000];
    const fires = spends.map((s) => computeCountryFire({ ...baseUser, currentSpending: s }, mx).fireNumber);
    for (let i = 1; i < fires.length; i++) {
      expect(fires[i]).toBeGreaterThan(fires[i - 1]);
    }
  });

  it('preTax = localizedSpending / (1 - effectiveTaxRate) holds for bracket-only countries', () => {
    const r = computeCountryFire(baseUser, fr);
    expect(r.preTaxWithdrawalNeeded).toBeCloseTo(r.localizedSpending / (1 - r.effectiveTaxRate), 2);
  });

  it('non-bracket countries report bracketTax = false and use the flat rate as effectiveTaxRate', () => {
    const py = countriesData.countries.find((c) => c.id === 'py') as Country;
    const r = computeCountryFire(baseUser, py);
    expect(r.bracketTax).toBe(false);
    expect(r.effectiveTaxRate).toBe(py.withdrawalTaxRate);
  });
});

describe('Korea joint bracket × NHIS scaling', () => {
  const baseUser: UserInputs = {
    currentSavings: 0,
    annualSavings: 50_000,
    currentSpending: 50_000,
    currentAge: 40,
    realReturn: 0.05,
  };
  const korea = countriesData.countries.find((c) => c.id === 'kr') as Country;

  it('Korea has BOTH taxBrackets and premiumModel', () => {
    expect(korea.taxBrackets).toBeDefined();
    expect(korea.premiumModel).toBeDefined();
  });

  it('Korea joint result satisfies preTax = (S*COL + premium) / (1 - effectiveTax)', () => {
    const r = computeCountryFire(baseUser, korea);
    const sc = baseUser.currentSpending * korea.colMultiplier;
    const expected = (sc + r.annualHealthcareUSD) / (1 - r.effectiveTaxRate);
    expect(r.preTaxWithdrawalNeeded).toBeCloseTo(expected, 2);
  });

  it('Korea joint solver converges (premium is consistent with rate × preTax inside the curve)', () => {
    const r = computeCountryFire(baseUser, korea);
    const model = korea.premiumModel!;
    const expectedPremium = Math.max(model.minUSD, Math.min(model.maxUSD, model.rate * r.preTaxWithdrawalNeeded));
    expect(r.annualHealthcareUSD).toBeCloseTo(expectedPremium, 1);
  });

  it('Korea FIRE number at high spending hits the premium ceiling', () => {
    const high: UserInputs = { ...baseUser, currentSpending: 150_000 };
    const r = computeCountryFire(high, korea);
    expect(r.annualHealthcareUSD).toBe(korea.premiumModel!.maxUSD);
  });

  it('Korea FIRE number at low spending hits the premium floor', () => {
    const low: UserInputs = { ...baseUser, currentSpending: 10_000 };
    const r = computeCountryFire(low, korea);
    expect(r.annualHealthcareUSD).toBe(korea.premiumModel!.minUSD);
  });
});

describe('countries.json integrity for bracket fields', () => {
  it('every taxBrackets array is non-empty and starts at thresholdUSD = 0', () => {
    for (const c of countriesData.countries) {
      if ('taxBrackets' in c && Array.isArray((c as Country).taxBrackets)) {
        const brackets = (c as Country).taxBrackets!;
        expect(brackets.length).toBeGreaterThan(0);
        expect(brackets[0].thresholdUSD).toBe(0);
      }
    }
  });

  it('every taxBrackets array has strictly ascending thresholds', () => {
    for (const c of countriesData.countries) {
      if ('taxBrackets' in c && Array.isArray((c as Country).taxBrackets)) {
        const brackets = (c as Country).taxBrackets!;
        for (let i = 1; i < brackets.length; i++) {
          expect(brackets[i].thresholdUSD).toBeGreaterThan(brackets[i - 1].thresholdUSD);
        }
      }
    }
  });

  it('every bracket rate is in [0, 1)', () => {
    for (const c of countriesData.countries) {
      if ('taxBrackets' in c && Array.isArray((c as Country).taxBrackets)) {
        for (const b of (c as Country).taxBrackets!) {
          expect(b.rate).toBeGreaterThanOrEqual(0);
          expect(b.rate).toBeLessThan(1);
        }
      }
    }
  });

  it('exactly 10 countries have bracket data', () => {
    const withBrackets = countriesData.countries.filter((c) => 'taxBrackets' in c).map((c) => c.id);
    expect(withBrackets.length).toBe(10);
    expect(withBrackets.sort()).toEqual(['de', 'es', 'fr', 'gb', 'jp', 'kr', 'mx', 'pt', 'th', 'us'].sort());
  });
});

describe('currency volatility', () => {
  const all = countriesData.countries as Country[];

  it('every country has currencyCode and currencyVolatilityPct', () => {
    for (const c of all) {
      expect(typeof c.currencyCode).toBe('string');
      expect(c.currencyCode.length).toBeGreaterThan(0);
      expect(typeof c.currencyVolatilityPct).toBe('number');
      expect(c.currencyVolatilityPct).toBeGreaterThanOrEqual(0);
      expect(c.currencyVolatilityPct).toBeLessThan(1);
    }
  });

  it('USD-using countries (US, Ecuador, Panama) have zero volatility', () => {
    const usdUsers = all.filter((c) => c.currencyCode === 'USD').map((c) => c.id).sort();
    expect(usdUsers).toEqual(['ec', 'pa', 'us']);
    for (const id of usdUsers) {
      const c = all.find((x) => x.id === id)!;
      expect(c.currencyVolatilityPct).toBe(0);
    }
  });

  it('Eurozone countries share EUR and the same volatility', () => {
    const eurCountries = all.filter((c) => c.currencyCode === 'EUR');
    expect(eurCountries.length).toBeGreaterThan(10);
    const vols = new Set(eurCountries.map((c) => c.currencyVolatilityPct));
    expect(vols.size).toBe(1);
  });

  it('hard-pegged currencies (UAE AED) have near-zero volatility', () => {
    const ae = all.find((c) => c.id === 'ae')!;
    expect(ae.currencyCode).toBe('AED');
    expect(ae.currencyVolatilityPct).toBeLessThanOrEqual(0.02);
  });

  it('crisis currencies (ARS, TRY) have high volatility', () => {
    const ar = all.find((c) => c.id === 'ar')!;
    const tr = all.find((c) => c.id === 'tr')!;
    expect(ar.currencyVolatilityPct).toBeGreaterThanOrEqual(0.2);
    expect(tr.currencyVolatilityPct).toBeGreaterThanOrEqual(0.2);
  });

  it('FireResult exposes stressFireNumber = fireNumber * (1 + vol)', () => {
    const baseUser: UserInputs = {
      currentSavings: 0,
      annualSavings: 50_000,
      currentSpending: 50_000,
      currentAge: 40,
      realReturn: 0.05,
    };
    // Test against a Korea (KRW, 10% vol) and US (USD, 0% vol)
    const us = all.find((c) => c.id === 'us')!;
    const kr = all.find((c) => c.id === 'kr')!;
    const usResult = computeCountryFire(baseUser, us);
    const krResult = computeCountryFire(baseUser, kr);
    expect(usResult.stressFireNumber).toBe(usResult.fireNumber); // 0 vol → no stress
    expect(krResult.stressFireNumber).toBeCloseTo(krResult.fireNumber * 1.1, 2);
  });

  it('stressFireNumber > fireNumber for non-USD countries', () => {
    const baseUser: UserInputs = {
      currentSavings: 0,
      annualSavings: 50_000,
      currentSpending: 50_000,
      currentAge: 40,
      realReturn: 0.05,
    };
    const nonUsd = all.filter((c) => c.currencyCode !== 'USD' && c.currencyVolatilityPct > 0);
    for (const c of nonUsd.slice(0, 10)) {
      const r = computeCountryFire(baseUser, c);
      if (Number.isFinite(r.fireNumber)) {
        expect(r.stressFireNumber).toBeGreaterThan(r.fireNumber);
      }
    }
  });

  it('Korea joint-solver result preserves currency stress field correctly', () => {
    const baseUser: UserInputs = {
      currentSavings: 0,
      annualSavings: 50_000,
      currentSpending: 50_000,
      currentAge: 40,
      realReturn: 0.05,
    };
    const kr = all.find((c) => c.id === 'kr')!;
    const r = computeCountryFire(baseUser, kr);
    expect(r.currencyCode).toBe('KRW');
    expect(r.currencyVolatilityPct).toBe(0.1);
    expect(r.stressFireNumber).toBeCloseTo(r.fireNumber * 1.1, 2);
  });
});

describe('bridgeYears', () => {
  it('returns 0 when fireAge is past Social Security earliest age', () => {
    expect(bridgeYears(SOCIAL_SECURITY_EARLIEST_AGE)).toBe(0);
    expect(bridgeYears(SOCIAL_SECURITY_EARLIEST_AGE + 5)).toBe(0);
    expect(bridgeYears(70)).toBe(0);
  });

  it('returns the gap when fireAge is below SS earliest', () => {
    expect(bridgeYears(50)).toBe(SOCIAL_SECURITY_EARLIEST_AGE - 50);
    expect(bridgeYears(40)).toBe(SOCIAL_SECURITY_EARLIEST_AGE - 40);
    expect(bridgeYears(35)).toBe(SOCIAL_SECURITY_EARLIEST_AGE - 35);
  });

  it('returns 0 for unreachable FIRE (Infinity)', () => {
    expect(bridgeYears(Infinity)).toBe(0);
  });
});

describe('hasLongBridge', () => {
  it('is true when bridge meets or exceeds the threshold', () => {
    const triggerAge = SOCIAL_SECURITY_EARLIEST_AGE - BRIDGE_THRESHOLD_YEARS;
    expect(hasLongBridge(triggerAge)).toBe(true);
    expect(hasLongBridge(triggerAge - 5)).toBe(true);
    expect(hasLongBridge(30)).toBe(true);
  });

  it('is false when bridge is below the threshold', () => {
    const justUnderTriggerAge = SOCIAL_SECURITY_EARLIEST_AGE - BRIDGE_THRESHOLD_YEARS + 1;
    expect(hasLongBridge(justUnderTriggerAge)).toBe(false);
    expect(hasLongBridge(SOCIAL_SECURITY_EARLIEST_AGE)).toBe(false);
    expect(hasLongBridge(70)).toBe(false);
  });

  it('is false for unreachable FIRE', () => {
    expect(hasLongBridge(Infinity)).toBe(false);
  });
});
