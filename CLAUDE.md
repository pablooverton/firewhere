# firewhere — AI Agent Context

## What this is

A static-site FIRE breakeven calculator. Given a user's savings, savings rate, and spending estimate, it returns the projected FIRE age in each of several countries. Pure computation. No backend. Deployed to GitHub Pages.

This tool is a front door — directional, fast, visual. It is not a replacement for full retirement modeling tools.

## Hard rules

### Never extract from lumpsum personal profiles

Country parameters in `src/data/countries.json` must be sourced from documented public sources only (OECD tax tables, Numbeo/Expatistan COL, country retirement-visa wikis). Do not pull values from `~/Developer/projects/lumpsum/cli/personal-*.json`, `private-*.json`, or any file containing real personal data.

The reason: in April 2026 a sibling repo had real names and balances in committed history for ~2 weeks. The air gap here is that `countries.json` shares no data path with personal profiles, period. Cross-checking against personal scenarios for sanity is fine; copying values is not.

### Never commit PII

No real names, balances, salaries, SS estimates, or identifying info in any tracked file. If a worked example is useful, use anonymized inputs.

### Cite sources in countries.json

Each country entry must include a `sources` array with URLs and a `lastVerified` date. A `confidence` flag (`high` | `medium` | `low`) reflects how stale or variable the underlying data is.

## Stack

- Next.js 16 (app router, `output: 'export'` → fully static)
- React 19, TypeScript strict
- Tailwind v4
- Vitest for tests
- Deploy: GitHub Pages via `.github/workflows/deploy.yml`, base path `/firewhere`

## Structure

```
src/
  app/             # Next.js app router pages
  domain/          # Pure FIRE math (no React, no I/O)
  data/            # countries.json + any other static data
  components/      # Reusable UI components
tests/             # Vitest tests against src/domain/
```

## Style

- Keep the math engine pure and side-effect-free. No fetches, no Date.now(), no env reads.
- Prefer fewer countries with high-confidence data over many countries with low-confidence data.
- Resist scope creep. The MVP answers one question: at what age can you FIRE in country X?
