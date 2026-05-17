'use client';

import { useMemo, useState } from 'react';
import { computeAll } from '@/domain/fire';
import type { Country, UserInputs } from '@/domain/types';

interface Props {
  countries: Country[];
}

const defaultInputs: UserInputs = {
  currentSavings: 250_000,
  annualSavings: 40_000,
  currentSpending: 60_000,
  currentAge: 40,
  realReturn: 0.05,
};

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatYears(n: number): string {
  if (!Number.isFinite(n)) return 'unreachable';
  if (n <= 0) return 'already there';
  return `${n.toFixed(1)} yrs`;
}

function formatAge(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

function confidenceColor(c: Country['confidence']): string {
  if (c === 'high') return 'bg-green-900/40 text-green-300 border-green-800';
  if (c === 'medium') return 'bg-yellow-900/40 text-yellow-300 border-yellow-800';
  return 'bg-red-900/40 text-red-300 border-red-800';
}

export function Calculator({ countries }: Props) {
  const [inputs, setInputs] = useState<UserInputs>(defaultInputs);

  const results = useMemo(() => computeAll(inputs, countries), [inputs, countries]);
  const countryById = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.id, c])),
    [countries]
  );

  const update = <K extends keyof UserInputs>(key: K, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg border border-gray-800 bg-gray-900/50">
        <NumberField
          label="Current savings (USD)"
          value={inputs.currentSavings}
          onChange={(v) => update('currentSavings', v)}
          step={5000}
          min={0}
        />
        <NumberField
          label="Annual savings (USD/yr)"
          value={inputs.annualSavings}
          onChange={(v) => update('annualSavings', v)}
          step={1000}
          min={0}
        />
        <NumberField
          label="Annual spending baseline (USD, US-equivalent)"
          value={inputs.currentSpending}
          onChange={(v) => update('currentSpending', v)}
          step={1000}
          min={0}
        />
        <NumberField
          label="Current age"
          value={inputs.currentAge}
          onChange={(v) => update('currentAge', v)}
          step={1}
          min={0}
          max={100}
        />
        <NumberField
          label="Expected real return (%)"
          value={Math.round(inputs.realReturn * 1000) / 10}
          onChange={(v) => update('realReturn', v / 100)}
          step={0.1}
          min={-5}
          max={20}
        />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white mb-4">Results</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Country</th>
                <th className="text-right px-4 py-3 font-medium">FIRE age</th>
                <th className="text-right px-4 py-3 font-medium">Years</th>
                <th className="text-right px-4 py-3 font-medium">Annual spend</th>
                <th className="text-right px-4 py-3 font-medium">FIRE number</th>
                <th className="text-left px-4 py-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const c = countryById[r.countryId];
                return (
                  <tr key={r.countryId} className="border-t border-gray-800 hover:bg-gray-900/40">
                    <td className="px-4 py-3 text-white">
                      <span className="font-medium">{c?.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{c?.flag}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {formatAge(r.fireAge)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatYears(r.yearsToFire)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUSD(r.localizedSpending)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUSD(r.fireNumber)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs border ${confidenceColor(r.confidence)}`}
                      >
                        {r.confidence}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Country notes</h2>
        {results.map((r) => {
          const c = countryById[r.countryId];
          if (!c) return null;
          return (
            <div key={c.id} className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
              <h3 className="font-semibold text-white mb-1">
                {c.name} <span className="text-gray-500 text-sm">{c.flag}</span>
              </h3>
              <p className="text-sm text-gray-400 mb-2">{c.residencyNote}</p>
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
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function NumberField({ label, value, onChange, step = 1, min, max }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}
