import type { Country, ComputeOptions, FilterCriteria, FireResult, UserInputs } from './types';
import { ENGLISH_LEVEL, SAFETY_THRESHOLD_SCORE, VISA_LEVEL } from './types';

export const DEFAULT_TARGET_RETIREMENT_AGE = 65;

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

/**
 * Years until CoastFIRE — the years from now until you can stop contributing
 * and let the portfolio grow at realReturn (no further contributions) to
 * reach the FIRE number by targetRetirementAge.
 *
 * Returns 0 if already CoastFIRE'd, Infinity if not reachable.
 *
 * Closed-form derivation (let q = 1+r, T = targetAge - currentAge, τ = saving years):
 *   portfolio(τ) = P0·q^τ + S·(q^τ − 1)/r
 *   coastTarget(τ) = F / q^(T − τ)
 *   Setting equal and solving:
 *     τ = T − log[(A·B − F) · r / S] / log(q)
 *   where A = P0 + S/r, B = q^T.
 *
 * Edge cases:
 *   - currentSavings ≥ fireNumber → already FIRE; coast trivially.
 *   - T ≤ 0 or r ≤ 0 → coast period is meaningless; degenerate to standard FIRE.
 *   - P0·q^T ≥ F → already CoastFIRE: do nothing now and you reach FIRE by target age.
 *   - A·B ≤ F → even maxed-out saving for T years can't reach F; unreachable.
 */
export function coastFireYears(
  currentSavings: number,
  annualSavings: number,
  realReturn: number,
  currentAge: number,
  targetRetirementAge: number,
  fireNumber: number
): number {
  if (currentSavings >= fireNumber) return 0;

  const T = targetRetirementAge - currentAge;
  if (T <= 0) return yearsToTarget(currentSavings, annualSavings, realReturn, fireNumber);
  if (realReturn <= 0) return yearsToTarget(currentSavings, annualSavings, realReturn, fireNumber);

  const r = realReturn;
  const q = 1 + r;
  const qT = Math.pow(q, T);

  if (currentSavings * qT >= fireNumber) return 0;
  if (annualSavings <= 0) return Infinity;

  const A = currentSavings + annualSavings / r;
  const B = qT;
  if (A * B <= fireNumber) return Infinity;

  const ratio = ((A * B) - fireNumber) * r / annualSavings;
  if (ratio <= 0) return Infinity;

  const tau = T - Math.log(ratio) / Math.log(q);
  return tau > 0 ? tau : 0;
}

const DEFAULT_OPTIONS: ComputeOptions = { mode: 'fire', targetRetirementAge: DEFAULT_TARGET_RETIREMENT_AGE };

export function computeCountryFire(
  user: UserInputs,
  country: Country,
  options: ComputeOptions = DEFAULT_OPTIONS
): FireResult {
  const localizedSpending =
    user.currentSpending * country.colMultiplier + country.annualHealthcareUSD;

  const preTaxWithdrawalNeeded =
    country.withdrawalTaxRate < 1
      ? localizedSpending / (1 - country.withdrawalTaxRate)
      : Infinity;

  const fireNumber = country.swr > 0 ? preTaxWithdrawalNeeded / country.swr : Infinity;
  const alreadyFire = user.currentSavings >= fireNumber;

  const yearsToFire =
    options.mode === 'coast'
      ? coastFireYears(
          user.currentSavings,
          user.annualSavings,
          user.realReturn,
          user.currentAge,
          options.targetRetirementAge,
          fireNumber
        )
      : yearsToTarget(user.currentSavings, user.annualSavings, user.realReturn, fireNumber);

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

export function computeAll(
  user: UserInputs,
  countries: Country[],
  options: ComputeOptions = DEFAULT_OPTIONS
): FireResult[] {
  return countries
    .map((c) => computeCountryFire(user, c, options))
    .sort((a, b) => a.fireAge - b.fireAge);
}

/**
 * Filter countries by region, safety, faith, visa, English, citizenship pathway, property, dual-citizenship.
 *
 * All filters compose with AND semantics. Empty / "any" values mean the filter is not applied.
 *
 * - regions: empty = no filter; otherwise country's region must be in the list.
 * - safety: keep countries with safetyScore ≤ threshold's upper bound. 'any' is unbounded.
 * - faiths: empty = no filter; otherwise country's dominantFaith must be in the list.
 * - visa: 'any' = no filter; otherwise include countries whose VISA_LEVEL is ≤ the threshold's level.
 * - english: 'any' = no filter; otherwise include countries whose ENGLISH_LEVEL is ≥ the threshold.
 * - citizenship: 'any' = no filter; otherwise country's yearsToCitizenship ≤ the threshold.
 * - property: 'any' = no filter; 'allowed' = freehold only; 'not-closed' = exclude only countries closed to foreign buyers.
 * - requireDualCitizenship: true = exclude countries that require renouncing US citizenship.
 */
export function filterCountries(countries: Country[], criteria: FilterCriteria): Country[] {
  const safetyMax = SAFETY_THRESHOLD_SCORE[criteria.safety];
  const regionSet = criteria.regions.length === 0 ? null : new Set(criteria.regions);
  const faithSet = criteria.faiths.length === 0 ? null : new Set(criteria.faiths);
  const visaMax = criteria.visa === 'any' ? Infinity : VISA_LEVEL[criteria.visa];
  const englishMin = criteria.english === 'any' ? -Infinity : ENGLISH_LEVEL[criteria.english];
  const citizenshipMax =
    criteria.citizenship === 'any' ? Infinity : parseInt(criteria.citizenship, 10);

  return countries.filter((c) => {
    if (regionSet && !regionSet.has(c.region)) return false;
    if (c.safetyScore > safetyMax) return false;
    if (faithSet && !faithSet.has(c.dominantFaith)) return false;
    if (VISA_LEVEL[c.visaDifficulty] > visaMax) return false;
    if (ENGLISH_LEVEL[c.englishLevel] < englishMin) return false;
    if (c.yearsToCitizenship > citizenshipMax) return false;
    if (criteria.property === 'allowed' && c.foreignerPropertyOwnership !== 'allowed') return false;
    if (criteria.property === 'not-closed' && c.foreignerPropertyOwnership === 'closed') return false;
    if (criteria.requireDualCitizenship && !c.dualCitizenshipAllowed) return false;
    return true;
  });
}
