import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'firewhere — International FIRE Breakeven Calculator',
  description:
    'Compare how soon you can reach financial independence across countries, accounting for local cost of living and tax structure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
