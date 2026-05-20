'use client';

import type { Mode, UserInputs } from '@/domain/types';
import { buildLumpslamURL } from '@/lib/lumpslam';
import { InfoTooltip } from './InfoTooltip';
import { NumberField } from './NumberField';

interface Props {
  inputs: UserInputs;
  setInputs: (updater: (prev: UserInputs) => UserInputs) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  targetAge: number;
  setTargetAge: (n: number) => void;
  onCopyLink: () => void;
  copied: boolean;
}

export function InputsPanel({
  inputs,
  setInputs,
  mode,
  setMode,
  targetAge,
  setTargetAge,
  onCopyLink,
  copied,
}: Props) {
  const update = <K extends keyof UserInputs>(key: K, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const lumpslamURL = buildLumpslamURL(inputs);

  return (
    <section className="p-6 rounded-lg border border-gray-800 bg-gray-900/50 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-400 flex items-center">
          Mode
          <InfoTooltip
            position="bottom"
            text="FIRE: years until you can stop working. CoastFIRE: years until you can stop saving and let the portfolio grow without contributions until your target retirement age."
          />
        </span>
        <div className="inline-flex rounded-md border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('fire')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              mode === 'fire' ? 'bg-blue-900/60 text-blue-100' : 'bg-gray-950 text-gray-400 hover:text-white'
            }`}
          >
            FIRE
          </button>
          <button
            type="button"
            onClick={() => setMode('coast')}
            className={`px-3 py-1.5 text-sm transition-colors border-l border-gray-700 ${
              mode === 'coast' ? 'bg-blue-900/60 text-blue-100' : 'bg-gray-950 text-gray-400 hover:text-white'
            }`}
          >
            CoastFIRE
          </button>
        </div>
        {mode === 'coast' && (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Target retirement age
            <input
              type="number"
              value={targetAge}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setTargetAge(v);
              }}
              step={1}
              min={30}
              max={100}
              className="w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-800">
        <a
          href={lumpslamURL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-amber-900/40 text-amber-100 border border-amber-800 hover:bg-amber-900/60 transition-colors"
          title="Pre-fill your current inputs in Lump Slam for full retirement modeling (Monte Carlo, Roth conversions, Social Security timing)."
        >
          <span>↗</span>
          Open in Lump Slam
        </a>
        <button
          type="button"
          onClick={onCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 transition-colors"
          title="Copy a shareable link with your current inputs and filters."
        >
          <span>{copied ? '✓' : '⎘'}</span>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <InfoTooltip
          position="bottom"
          text="Open in Lump Slam pre-fills the deeper tool with your firewhere inputs to run Monte Carlo, Roth conversion timing, and Social Security strategy. Copy link saves your current inputs + filters in a shareable URL."
        />
      </div>
    </section>
  );
}
