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
  /** Multiplier on user's USD baseline spending. 1.00 = US baseline. */
  colMultiplier: number;
  /** Additive baseline annual healthcare cost in USD for a retired adult / small family. */
  annualHealthcareUSD: number;
  /** Approximate effective tax rate on retirement withdrawals. */
  withdrawalTaxRate: number;
  /** Suggested safe withdrawal rate baseline. */
  swr: number;
  residencyNote: string;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{ name: string; url: string | null; lastVerified: string }>;
  caveats: string[];
}

export interface CountryDataFile {
  version: string;
  lastUpdated: string;
  schema: Record<string, string>;
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
