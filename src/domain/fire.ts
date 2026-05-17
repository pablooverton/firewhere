import type { Country, FilterCriteria, FireResult, UserInputs } from './types';
import { ENGLISH_LEVEL, SAFETY_THRESHOLD_SCORE, VISA_LEVEL } from './types';

/**
 * Closed-form solve for the number of years until a portfolio with periodic
 * contributions reaches a target value.
 *
 * Model:  P(t) = currentSavings * (1+r)^t + annualSavings * ((1+r)^t - 1) / r
 * Solve P(t) = target for t.
 *
 * Contributions are treated as end-of-year additions for simplicity. Real returns
 * (inflation-adjusted) are assumed, so all dollar quantities stay in today's USD.
 *
 * Returns Infinity if the target cannot be reached (insufficient contributions at
 * zero/negative return, or contributions plus principal can never grow to target).
 */
export function yearsToTarget(
  currentSavings: number,
  annualSavings: number,
  realReturn: number,
  target: number
): number {
  if (currentSavings >= target) return 0;

  const shortfall = target - currentSavings;

  if (realReturn === 0) {
    if (annualSavings <= 0) return Infinity;
    return shortfall / annualSavings;
  }

  if (realReturn < 0) {
    if (annualSavings <= 0) return Infinity;
    const annuityCap = annualSavings / -realReturn;
    if (currentSavings + annuityCap <= target) return Infinity;
  }

  const r = realReturn;
  const numerator = target + annualSavings / r;
  const denominator = currentSavings + annualSavings / r;

  if (denominator <= 0) return Infinity;
  const x = numerator / denominator;
  if (x <= 0) return Infinity;

  const t = Math.log(x) / Math.log(1 + r);
  return t > 0 && Number.isFinite(t) ? t : Infinity;
}

export function computeCountryFire(user: UserInputs, country: Country): FireResult {
  const localizedSpending =
    user.currentSpending * country.colMultiplier + country.annualHealthcareUSD;

  const preTaxWithdrawalNeeded =
    country.withdrawalTaxRate < 1
      ? localizedSpending / (1 - country.withdrawalTaxRate)
      : Infinity;

  const fireNumber = country.swr > 0 ? preTaxWithdrawalNeeded / country.swr : Infinity;
  const alreadyFire = user.currentSavings >= fireNumber;

  const yearsToFire = yearsToTarget(
    user.currentSavings,
    user.annualSavings,
    user.realReturn,
    fireNumber
  );

  const fireAge = Number.isFinite(yearsToFire) ? user.currentAge + yearsToFire : Infinity;

  return {
    countryId: country.id,
    localizedSpending,
    preTaxWithdrawalNeeded,
    fireNumber,
    yearsToFire,
    fireAge,
    alreadyFire,
    confidence: country.confidence,
  };
}

export function computeAll(user: UserInputs, countries: Country[]): FireResult[] {
  return countries
    .map((c) => computeCountryFire(user, c))
    .sort((a, b) => a.fireAge - b.fireAge);
}

/**
 * Filter countries by region, safety, faith, visa difficulty, and English level.
 *
 * - regions: empty array means no region filter; otherwise the country's region must be in the list.
 * - safety: keep countries with safetyScore <= the threshold's upper bound. 'any' is unbounded.
 * - faiths: empty array means no faith filter; otherwise the country's dominantFaith must be in the list.
 * - visa: 'any' means no filter; otherwise include countries whose VISA_LEVEL is at or below the threshold's level.
 * - english: 'any' means no filter; otherwise include countries whose ENGLISH_LEVEL is at or above the threshold.
 */
export function filterCountries(countries: Country[], criteria: FilterCriteria): Country[] {
  const safetyMax = SAFETY_THRESHOLD_SCORE[criteria.safety];
  const regionSet = criteria.regions.length === 0 ? null : new Set(criteria.regions);
  const faithSet = criteria.faiths.length === 0 ? null : new Set(criteria.faiths);
  const visaMax = criteria.visa === 'any' ? Infinity : VISA_LEVEL[criteria.visa];
  const englishMin = criteria.english === 'any' ? -Infinity : ENGLISH_LEVEL[criteria.english];

  return countries.filter((c) => {
    if (regionSet && !regionSet.has(c.region)) return false;
    if (c.safetyScore > safetyMax) return false;
    if (faithSet && !faithSet.has(c.dominantFaith)) return false;
    if (VISA_LEVEL[c.visaDifficulty] > visaMax) return false;
    if (ENGLISH_LEVEL[c.englishLevel] < englishMin) return false;
    return true;
  });
}
