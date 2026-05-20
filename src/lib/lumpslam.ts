import type { UserInputs } from '@/domain/types';

const LUMPSLAM_BASE = 'https://www.pablooverton.com/lumpslam/profile/';

export function buildLumpslamURL(inputs: UserInputs): string {
  const p = new URLSearchParams({
    source: 'firewhere',
    currentAge: String(inputs.currentAge),
    currentSavings: String(inputs.currentSavings),
    annualSavings: String(inputs.annualSavings),
    currentSpending: String(inputs.currentSpending),
    realReturn: String(inputs.realReturn),
  });
  return `${LUMPSLAM_BASE}?${p.toString()}`;
}
