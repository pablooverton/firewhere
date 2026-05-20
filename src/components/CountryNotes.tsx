'use client';

import type { Country, FireResult } from '@/domain/types';

interface Props {
  sortedResults: FireResult[];
  countryById: Record<string, Country>;
}

export function CountryNotes({ sortedResults, countryById }: Props) {
  if (sortedResults.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Country notes</h2>
      {sortedResults.map((r) => {
        const c = countryById[r.countryId];
        if (!c) return null;
        return (
          <div key={c.id} className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
            <h3 className="font-semibold text-white mb-1">
              {c.name} <span className="text-gray-500 text-sm">{c.flag} · {c.region}</span>
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
  );
}
