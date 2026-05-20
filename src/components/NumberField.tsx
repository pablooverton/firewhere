'use client';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function NumberField({ label, value, onChange, step = 1, min, max }: Props) {
  // Uncontrolled input: the browser owns the text state during editing so transient
  // states like "" or "5." don't get clobbered by a re-render that snaps the value
  // back to the parsed/formatted number. Auto-select on focus so click-then-type
  // replaces the existing value cleanly.
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        defaultValue={value}
        step={step}
        min={min}
        max={max}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const next = e.target.value;
          // Skip transient states — wait for a complete number before committing.
          if (next === '' || next === '-' || next.endsWith('.')) return;
          const parsed = Number(next);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={(e) => {
          const next = e.target.value;
          const parsed = Number(next);
          if (!Number.isFinite(parsed) || next === '' || next === '-') {
            e.target.value = String(value);
          }
        }}
        className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
      />
    </label>
  );
}
