import { Calculator } from '@/components/Calculator';
import countriesData from '@/data/countries.json';
import type { Country } from '@/domain/types';

export default function HomePage() {
  const countries = countriesData.countries as Country[];

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-white mb-3">firewhere</h1>
        <p className="text-gray-400 text-lg">
          At what age can you reach financial independence, in each country?
        </p>
      </header>

      <div className="mb-10 p-5 rounded-lg border border-amber-900/40 bg-amber-950/20 text-sm text-amber-100/90 space-y-2">
        <p>
          <strong className="text-amber-200">Directional, not advisory.</strong>{' '}
          firewhere is a fast comparison tool. The model is intentionally simple:
          cost-of-living adjustment + healthcare delta + flat effective tax + 4% rule.
          It does not handle Monte Carlo simulation, Roth conversion timing, Social Security
          strategy, sequence-of-returns risk, currency volatility, or country-specific
          pension contribution scaling. For full retirement modeling, use{' '}
          <a
            href="https://www.pablooverton.com/lumpslam/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200"
          >
            Lump Slam
          </a>{' '}
          or a comparable planner with a real engine.
        </p>
        <p className="text-amber-200/80">
          <strong className="text-amber-200">Data freshness.</strong>{' '}
          Cost-of-living indices, tax structures, healthcare costs, and safety scores change
          every year. Tax law in particular shifts frequently (Portugal NHR, Thailand
          remittance rules, Italy 7% regime). Always verify the current values with a
          cross-border tax specialist before any irreversible decision. Data last reviewed:{' '}
          <span className="font-mono">{countriesData.lastReviewed}</span>.
        </p>
      </div>

      <Calculator countries={countries} dataSources={countriesData.dataSources} />

      <footer className="mt-16 pt-8 border-t border-gray-800 text-sm text-gray-500 space-y-2">
        <p>
          Cost-of-living: <a href={countriesData.dataSources.costOfLiving.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">{countriesData.dataSources.costOfLiving.name}</a>.{' '}
          Safety: <a href={countriesData.dataSources.safety.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">{countriesData.dataSources.safety.name}</a>.{' '}
          Healthcare and tax values are heuristic midpoints from each country&apos;s public tax / health authority — see per-country sources.
        </p>
        <p>
          Data version {countriesData.version} · last reviewed {countriesData.lastReviewed} · {countries.length} countries
        </p>
      </footer>
    </main>
  );
}
