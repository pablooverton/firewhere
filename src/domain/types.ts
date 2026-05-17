export type Region =
  | 'Americas'
  | 'Europe'
  | 'East Asia'
  | 'Southeast Asia'
  | 'Middle East & Africa'
  | 'Oceania';

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

export interface Country {
  id: string;
  name: string;
  flag: string;
  region: Region;
  /** Multiplier on user's USD baseline spending. 1.00 = US baseline. */
  colMultiplier: number;
  /** Additive baseline annual healthcare cost in USD for a retired adult / small family. */
  annualHealthcareUSD: number;
  /** Approximate effective tax rate on retirement withdrawals. */
  withdrawalTaxRate: number;
  /** Suggested safe withdrawal rate baseline. */
  swr: number;
  /** Global Peace Index score. 1.0 = most peaceful, ~3.5 = least. Lower is safer. */
  safetyScore: number;
  /** GPI rank out of ~163 countries. Lower is safer. */
  safetyRank: number;
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
}

export type SafetyThreshold = 'any' | 'very-safe' | 'safe' | 'moderate';

export interface FilterCriteria {
  regions: Region[];
  safety: SafetyThreshold;
}

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
