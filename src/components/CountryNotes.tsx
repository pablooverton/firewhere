'use client';

import { bridgeYears, hasLongBridge, SOCIAL_SECURITY_EARLIEST_AGE } from '@/domain/fire';
import type { Country, FireResult, Mode, UserInputs } from '@/domain/types';
import { formatUSD } from '@/lib/format';
import { buildLumpslamURL } from '@/lib/lumpslam';

interface Props {
  sortedResults: FireResult[];
  countryById: Record<string, Country>;
  mode: Mode;
  inputs: UserInputs;
}

export function CountryNotes({ sortedResults, countryById, mode, inputs }: Props) {
  if (sortedResults.length === 0) return null;
  const lumpslamURL = buildLumpslamURL(inputs);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Country notes</h2>
      {sortedResults.map((r) => {
        const c = countryById[r.countryId];
        if (!c) return null;
        const showBridgeWarning = mode === 'fire' && hasLongBridge(r.fireAge);
        return (
          <div key={c.id} className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
            <h3 className="font-semibold text-white mb-1">
              {c.name} <span className="text-gray-500 text-sm">{c.flag} · {c.region}</span>
            </h3>
            <p className="text-sm text-gray-400 mb-2">{c.residencyNote}</p>
            {r.bracketTax && (
              <BracketTaxDetail result={r} country={c} />
            )}
            {r.premiumScales && c.premiumModel && (
              <ScaledPremiumDetail result={r} model={c.premiumModel} />
            )}
            {r.currencyVolatilityPct > 0 && Number.isFinite(r.fireNumber) && (
              <CurrencyDetail result={r} />
            )}
            {showBridgeWarning && (
              <BridgeWarning fireAge={r.fireAge} lumpslamURL={lumpslamURL} />
            )}
            {c.caveats.length > 0 && (
              <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
                {c.caveats.map((cav, i) => (
                  <li key={i}>{cav}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function CurrencyDetail({ result }: { result: FireResult }) {
  const stressDelta = result.stressFireNumber - result.fireNumber;
  return (
    <div className="mb-2 p-2 rounded-md border border-amber-900/40 bg-amber-950/20 text-xs text-amber-100/90">
      <span className="font-semibold text-amber-200">Currency:</span>{' '}
      {result.currencyCode} — {(result.currencyVolatilityPct * 100).toFixed(0)}% annualized volatility vs USD.{' '}
      <span className="text-amber-300/70">
        1σ adverse move adds {formatUSD(stressDelta)} to FIRE number ({formatUSD(result.fireNumber)} → {formatUSD(result.stressFireNumber)}).
      </span>
    </div>
  );
}

function BracketTaxDetail({ result, country }: { result: FireResult; country: Country }) {
  const brackets = country.taxBrackets!;
  const topRate = brackets[brackets.length - 1].rate;
  const allowance = country.personalAllowanceUSD ?? 0;
  return (
    <div className="mb-2 p-2 rounded-md border border-violet-900/40 bg-violet-950/20 text-xs text-violet-100/90">
      <span className="font-semibold text-violet-200">Tax:</span>{' '}
      effective {(result.effectiveTaxRate * 100).toFixed(1)}% on {formatUSD(result.preTaxWithdrawalNeeded)} withdrawal{' '}
      <span className="text-violet-300/70">(progressive brackets, top rate {(topRate * 100).toFixed(0)}%)</span>
      {allowance > 0 && (
        <span className="text-violet-300/50"> — personal allowance {formatUSD(allowance)}</span>
      )}
    </div>
  );
}

function ScaledPremiumDetail({
  result,
  model,
}: {
  result: FireResult;
  model: NonNullable<Country['premiumModel']>;
}) {
  const atFloor = result.annualHealthcareUSD === model.minUSD;
  const atCeiling = result.annualHealthcareUSD === model.maxUSD;
  const position = atFloor ? 'at floor' : atCeiling ? 'at ceiling' : 'scales with income';
  return (
    <div className="mb-2 p-2 rounded-md border border-sky-900/40 bg-sky-950/20 text-xs text-sky-100/90">
      <span className="font-semibold text-sky-200">Healthcare:</span>{' '}
      {formatUSD(result.annualHealthcareUSD)}/yr <span className="text-sky-300/70">({position})</span>{' '}
      <span className="text-sky-300/50">
        — public premium ~{(model.rate * 100).toFixed(1)}% of declared income, bounded {formatUSD(model.minUSD)}–{formatUSD(model.maxUSD)}
      </span>
    </div>
  );
}

function BridgeWarning({ fireAge, lumpslamURL }: { fireAge: number; lumpslamURL: string }) {
  const yrs = bridgeYears(fireAge);
  return (
    <div className="mb-2 p-3 rounded-md border border-amber-900/50 bg-amber-950/30 text-xs text-amber-100/90 space-y-1.5">
      <p>
        <span className="font-semibold text-amber-200">⚠ Long pre-SS bridge:</span>{' '}
        {yrs.toFixed(0)} years between FIRE age ({fireAge.toFixed(1)}) and Social Security at {SOCIAL_SECURITY_EARLIEST_AGE}.
        Sequence-of-returns risk is concentrated in this period. A bad market in your first few retirement years can permanently impair the portfolio.
      </p>
      <p>
        <a
          href={lumpslamURL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline hover:text-amber-200"
        >
          Stress-test in Lump Slam <span aria-hidden="true">↗</span>
        </a>
      </p>
    </div>
  );
}
