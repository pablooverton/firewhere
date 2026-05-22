export type Region =
  | 'Americas'
  | 'Europe'
  | 'East Asia'
  | 'Southeast Asia'
  | 'Middle East & Africa'
  | 'Oceania';

export type Faith =
  | 'Catholic'
  | 'Protestant'
  | 'Orthodox'
  | 'Christian (mixed)'
  | 'Muslim'
  | 'Buddhist'
  | 'Hindu'
  | 'Jewish'
  | 'Secular';

export type VisaDifficulty = 'easy' | 'medium' | 'hard' | 'closed';

export type EnglishLevel = 'widespread' | 'urban' | 'limited';

export type PropertyOwnership = 'allowed' | 'restricted' | 'leasehold-only' | 'closed';

export type Mode = 'fire' | 'coast';

export interface ComputeOptions {
  mode: Mode;
  /** Target retirement age used in CoastFIRE mode. */
  targetRetirementAge: number;
}

export type CitizenshipThreshold = 'any' | '10' | '5' | '3';

export const ALL_FAITHS: Faith[] = [
  'Catholic',
  'Protestant',
  'Orthodox',
  'Christian (mixed)',
  'Muslim',
  'Buddhist',
  'Hindu',
  'Jewish',
  'Secular',
];

export const VISA_OPTIONS: Array<{ value: VisaDifficulty | 'any'; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'easy', label: 'Easy (dedicated retirement visa)' },
  { value: 'medium', label: 'Easy or moderate (≤ medium)' },
  { value: 'hard', label: 'Up to hard (excludes closed)' },
];

export interface UserInputs {
  /** Current liquid savings in USD. */
  currentSavings: number;
  /** Annual savings rate in USD per year (real, post-tax). */
  annualSavings: number;
  /** Annual spending baseline in USD (US-equivalent purchasing power). */
  currentSpending: number;
  /** User's current age in years. */
  currentAge: number;
  /** Expected real (inflation-adjusted) annual return on portfolio. 0.05 = 5%. */
  realReturn: number;
}

/**
 * Income-scaled health premium curve. Models systems like Korea NHIS and Japan NHI
 * where the public-insurance premium scales with declared income, bounded by a
 * statutory floor and ceiling. Total annual healthcare cost is then
 *   clamp(rate * preTaxWithdrawal, minUSD, maxUSD).
 */
export interface PremiumModel {
  type: 'income-scaled';
  /** Marginal premium rate as a fraction of preTax withdrawal (used as proxy for declared income). */
  rate: number;
  /** Annual floor — minimum total healthcare cost regardless of income. */
  minUSD: number;
  /** Annual ceiling — maximum total healthcare cost; the income-scaled premium caps here. */
  maxUSD: number;
}

/**
 * One marginal tax bracket. The bracket's rate applies to taxable income above
 * thresholdUSD up to (but not including) the next bracket's thresholdUSD; the
 * top bracket applies to all income above its threshold. Brackets are sorted
 * ascending by thresholdUSD and the first bracket has thresholdUSD = 0.
 */
export interface TaxBracket {
  /** Lower bound of this bracket in USD. First bracket = 0. */
  thresholdUSD: number;
  /** Marginal tax rate within this bracket, [0, 1). */
  rate: number;
}

export interface Country {
  id: string;
  name: string;
  flag: string;
  region: Region;
  /** Multiplier on user's USD baseline spending. 1.00 = US baseline. */
  colMultiplier: number;
  /** Additive baseline annual healthcare cost in USD for a retired adult / small family. Used directly when premiumModel is absent; treated as a documentation fallback when premiumModel is present. */
  annualHealthcareUSD: number;
  /** Optional income-scaled premium curve (Korea NHIS, Japan NHI). When present, overrides annualHealthcareUSD at compute time. */
  premiumModel?: PremiumModel;
  /** Approximate effective tax rate on retirement withdrawals. Used directly when taxBrackets is absent; treated as a documentation fallback (effective rate at moderate retirement income, typically calibrated near $50k baseline) when taxBrackets is present. */
  withdrawalTaxRate: number;
  /** Optional progressive bracket structure. When present, replaces withdrawalTaxRate at compute time. Brackets are evaluated on taxable income = max(0, preTax - personalAllowanceUSD). */
  taxBrackets?: TaxBracket[];
  /** Personal allowance / standard deduction in USD. Subtracted from preTax before bracket evaluation. Only meaningful when taxBrackets is present. */
  personalAllowanceUSD?: number;
  /** Suggested safe withdrawal rate baseline. */
  swr: number;
  /** Global Peace Index score. 1.0 = most peaceful, ~3.5 = least. Lower is safer. */
  safetyScore: number;
  /** GPI rank out of ~163 countries. Lower is safer. */
  safetyRank: number;
  /** Dominant religious tradition (cultural majority, not necessarily practicing). */
  dominantFaith: Faith;
  /** Difficulty of obtaining a retirement / long-term residency visa as a US citizen. */
  visaDifficulty: VisaDifficulty;
  /** How widely English is spoken locally. */
  englishLevel: EnglishLevel;
  /** Standard residency-based naturalization years for a US citizen with no heritage / fast-track path. */
  yearsToCitizenship: number;
  /** Whether the country permits dual citizenship with the US (false = must renounce US). */
  dualCitizenshipAllowed: boolean;
  /** Foreign residential property ownership classification. */
  foreignerPropertyOwnership: PropertyOwnership;
  residencyNote: string;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{ name: string; url: string | null; lastVerified: string }>;
  caveats: string[];
}

export interface DataSource {
  name: string;
  url: string;
  publisher: string;
  updateFrequency: string;
  lastVerified: string;
  note?: string;
}

export interface CountryDataFile {
  version: string;
  lastUpdated: string;
  lastReviewed: string;
  schema: Record<string, string>;
  dataSources: {
    safety: DataSource;
    costOfLiving: DataSource;
  };
  countries: Country[];
}

export interface FireResult {
  countryId: string;
  /** Annual spending in USD adjusted for local cost of living + healthcare. */
  localizedSpending: number;
  /** Pre-tax annual portfolio withdrawal required to fund localized spending. */
  preTaxWithdrawalNeeded: number;
  /** Portfolio size at which SWR draws cover withdrawals. */
  fireNumber: number;
  /** Years from now to reach fireNumber. Infinity if unreachable. */
  yearsToFire: number;
  /** Projected FIRE age. Infinity if unreachable. */
  fireAge: number;
  /** True if user already has enough to retire here. */
  alreadyFire: boolean;
  confidence: 'high' | 'medium' | 'low';
  /** Annual healthcare cost actually used in this calculation. For income-scaled countries this may differ from Country.annualHealthcareUSD. */
  annualHealthcareUSD: number;
  /** True if this country's healthcare premium scales with income. */
  premiumScales: boolean;
  /** Effective tax rate actually used in this calculation. Equals withdrawalTaxRate for flat-tax countries; computed from brackets for bracket countries. */
  effectiveTaxRate: number;
  /** True if this country uses progressive bracket-level tax math. */
  bracketTax: boolean;
}

export type SafetyThreshold = 'any' | 'very-safe' | 'safe' | 'moderate';

export interface FilterCriteria {
  regions: Region[];
  safety: SafetyThreshold;
  /** Empty array = no faith filter (show all). */
  faiths: Faith[];
  /** "any" = no visa filter. Otherwise: include all countries up to and including this difficulty level. */
  visa: VisaDifficulty | 'any';
  /** "any" = no language filter. Otherwise: include countries at this English level or better (widespread > urban > limited). */
  english: EnglishLevel | 'any';
  /** Citizenship pathway threshold: "any" = no filter; otherwise yearsToCitizenship must be ≤ the chosen value. */
  citizenship: CitizenshipThreshold;
  /** Property ownership filter: "any" = no filter; "allowed" = freehold only; "not-closed" = include allowed/restricted/leasehold but exclude closed. */
  property: 'any' | 'allowed' | 'not-closed';
  /** Dual-citizenship-with-US must be permitted. */
  requireDualCitizenship: boolean;
}

export const CITIZENSHIP_OPTIONS: Array<{ value: CitizenshipThreshold; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '10', label: 'Within 10 yrs' },
  { value: '5', label: 'Within 5 yrs' },
  { value: '3', label: 'Within 3 yrs (fast track)' },
];

export const PROPERTY_OPTIONS: Array<{ value: FilterCriteria['property']; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'not-closed', label: 'Foreigners can buy (any form)' },
  { value: 'allowed', label: 'Freehold ownership only' },
];

/** Numeric ordering for visa difficulty so "include up to X" filter works. */
export const VISA_LEVEL: Record<VisaDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  closed: 3,
};

/** Numeric ordering for English level so "at least X" filter works. */
export const ENGLISH_LEVEL: Record<EnglishLevel, number> = {
  widespread: 2,
  urban: 1,
  limited: 0,
};

/** Upper-bound GPI score per safety threshold. Lower GPI = more peaceful. */
export const SAFETY_THRESHOLD_SCORE: Record<SafetyThreshold, number> = {
  any: Infinity,
  moderate: 2.5,
  safe: 2.0,
  'very-safe': 1.5,
};

export const ALL_REGIONS: Region[] = [
  'Americas',
  'Europe',
  'East Asia',
  'Southeast Asia',
  'Middle East & Africa',
  'Oceania',
];
