import { Calculator } from '@/components/Calculator';
import countriesData from '@/data/countries.json';
import type { Country } from '@/domain/types';

export default function HomePage() {
  const countries = countriesData.countries as Country[];

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">firewhere</h1>
        <p className="text-gray-400 text-lg">
          At what age can you reach financial independence, in each country?
        </p>
      </header>

      <Calculator countries={countries} />

      <footer className="mt-16 pt-8 border-t border-gray-800 text-sm text-gray-500 space-y-2">
        <p>
          Directional, not advisory. Cost-of-living and tax parameters are public-source estimates
          with the confidence flag shown per country. For full retirement modeling (Monte Carlo,
          Roth conversion, Social Security timing, sequence-of-returns), use a dedicated planner.
        </p>
        <p>
          Data version {countriesData.version} · last updated {countriesData.lastUpdated}
        </p>
      </footer>
    </main>
  );
}
