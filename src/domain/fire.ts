import type { Country, ComputeOptions, FilterCriteria, FireResult, PremiumModel, UserInputs } from './types';
import { ENGLISH_LEVEL, SAFETY_THRESHOLD_SCORE, VISA_LEVEL } from './types';

export const DEFAULT_TARGET_RETIREMENT_AGE = 65;

/** Earliest age a US worker can claim reduced Social Security benefits. */
export const SOCIAL_SECURITY_EARLIEST_AGE = 62;

/**
 * Threshold for surfacing a bridge-years warning. A FIRE age this far below
 * SS-earliest concentrates the sequence-of-returns risk window into a long
 * unbridged period, where a bad early-retirement market can permanently
 * impair the portfolio.
 */
export const BRIDGE_THRESHOLD_YEARS = 12;

/** Years between FIRE age and earliest Social Security claim. Zero if already past SS age or unreachable. */
export function bridgeYears(fireAge: number): number {
  if (!Number.isFinite(fireAge)) return 0;
  return Math.max(0, SOCIAL_SECURITY_EARLIEST_AGE - fireAge);
}

/** True when the bridge from FIRE age to SS-earliest is long enough to warrant a sequence-risk warning. */
export function hasLongBridge(fireAge: number): boolean {
  return bridgeYears(fireAge) >= BRIDGE_THRESHOLD_YEARS;
}

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

/**
 * Solve the joint healthcare/withdrawal system for a country whose healthcare premium
 * scales with declared income (Korea NHIS, Japan NHI).
 *
 * System:
 *   localizedSpending = baselineSpend * COL + premium
 *   premium           = clamp(rate * preTax, minUSD, maxUSD)
 *   preTax            = localizedSpending / (1 - tax)
 *
 * Closed-form by region:
 *   Interior  preTax = (baselineSpend * COL) / (1 - tax - rate)
 *   Floor     preTax = (baselineSpend * COL + minUSD) / (1 - tax)
 *   Ceiling   preTax = (baselineSpend * COL + maxUSD) / (1 - tax)
 *
 * Region selection: compute the interior premium; if it falls below minUSD use the
 * floor branch, above maxUSD use the ceiling branch, otherwise interior.
 *
 * Defensive: if (1 - tax - rate) ≤ 0 the interior is undefined; fall through to
 * the ceiling branch (highest-income case) so the answer remains finite.
 */
export function solveIncomeScaledPremium(
  baselineSpend: number,
  colMultiplier: number,
  tax: number,
  model: PremiumModel
): { premium: number; preTax: number } {
  const sc = baselineSpend * colMultiplier;
  const denom = 1 - tax - model.rate;

  if (denom <= 0) {
    const preTax = (sc + model.maxUSD) / (1 - tax);
    return { premium: model.maxUSD, preTax };
  }

  const interiorPreTax = sc / denom;
  const interiorPremium = model.rate * interiorPreTax;

  if (interiorPremium < model.minUSD) {
    const preTax = (sc + model.minUSD) / (1 - tax);
    return { premium: model.minUSD, preTax };
  }
  if (interiorPremium > model.maxUSD) {
    const preTax = (sc + model.maxUSD) / (1 - tax);
    return { premium: model.maxUSD, preTax };
  }
  return { premium: interiorPremium, preTax: interiorPreTax };
}

/** Annual healthcare cost for a country at a given pre-tax withdrawal income level. */
export function annualHealthcareCost(country: Country, preTaxIncome: number): number {
  if (country.premiumModel?.type === 'income-scaled') {
    const m = country.premiumModel;
    return Math.max(m.minUSD, Math.min(m.maxUSD, m.rate * preTaxIncome));
  }
  return country.annualHealthcareUSD;
}

export function computeCountryFire(
  user: UserInputs,
  country: Country,
  options: ComputeOptions = DEFAULT_OPTIONS
): FireResult {
  let premium: number;
  let preTaxWithdrawalNeeded: number;

  if (country.premiumModel?.type === 'income-scaled' && country.withdrawalTaxRate < 1) {
    const solved = solveIncomeScaledPremium(
      user.currentSpending,
      country.colMultiplier,
      country.withdrawalTaxRate,
      country.premiumModel
    );
    premium = solved.premium;
    preTaxWithdrawalNeeded = solved.preTax;
  } else {
    premium = country.annualHealthcareUSD;
    const localized = user.currentSpending * country.colMultiplier + premium;
    preTaxWithdrawalNeeded =
      country.withdrawalTaxRate < 1 ? localized / (1 - country.withdrawalTaxRate) : Infinity;
  }

  const localizedSpending = user.currentSpending * country.colMultiplier + premium;

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
    annualHealthcareUSD: premium,
    premiumScales: country.premiumModel?.type === 'income-scaled',
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
