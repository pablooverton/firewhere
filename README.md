# firewhere

A simple FIRE breakeven calculator that compares retirement age across countries.

Input your current savings, annual savings amount, and target spending. The tool returns a side-by-side comparison of how soon you can reach financial independence in each supported country, accounting for local cost-of-living and tax structure.

## Status

Pre-release. MVP scope: 4 countries (US base, Korea, Japan, Taiwan).

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run lint
npm run build      # static export to ./out
```

## Data sources

Country parameters in `src/data/countries.json` are sourced from public references (OECD tax data, Numbeo/Expatistan cost-of-living, country retirement-visa documentation). Each entry includes citations and a confidence flag. The numbers are directional — for serious retirement planning, use a full-featured tool.

## License

TBD.
