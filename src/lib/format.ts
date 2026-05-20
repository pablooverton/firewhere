import type { Country } from '@/domain/types';

export const CONFIDENCE_ORDER: Record<Country['confidence'], number> = { high: 0, medium: 1, low: 2 };

/** Numeric compare that pushes Infinity (unreachable) to the end on ascending sorts. */
export function cmpNum(a: number, b: number): number {
  const aFin = Number.isFinite(a);
  const bFin = Number.isFinite(b);
  if (!aFin && !bFin) return 0;
  if (!aFin) return 1;
  if (!bFin) return -1;
  return a - b;
}

export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatYears(n: number): string {
  if (!Number.isFinite(n)) return 'unreachable';
  if (n <= 0) return 'already there';
  return `${n.toFixed(1)} yrs`;
}

export function formatAge(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export function confidenceColor(c: Country['confidence']): string {
  if (c === 'high') return 'bg-green-900/40 text-green-300 border-green-800';
  if (c === 'medium') return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-red-900/40 text-red-300 border-red-800';
}

export function safetyColor(score: number): string {
  if (score <= 1.5) return 'bg-green-900/40 text-green-300 border-green-800';
  if (score <= 2.0) return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
  if (score <= 2.5) return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-red-900/40 text-red-300 border-red-800';
}
