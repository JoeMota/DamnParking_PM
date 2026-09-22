# Damn Parking - Living Project Portal

UTEP **CS 4390 / 5388 Software Project Management** deliverable: a public Living Project Portal for **Damn Parking**, a campus computer-vision concept that turns lot cameras into a live open-stall signal.

This repository is the website source (static HTML/CSS/JS). The 3D lot on the home page is a cinematic visualization, not a production CV system.

## Run locally

```bash
# from repo root
python3 -m http.server 8080
# open http://localhost:8080
```

Or: `npm start` (same static server).

Or use any static host (GitHub Pages, Netlify, Vercel). Point Pages / Vercel at `/` (repo root).

### Vercel

This site is **static HTML/CSS/JS**, not a Preact/React build. `vercel.json` forces Framework Preset **Other** (`framework: null`), skips install/build, serves `outputDirectory: "."`, enables `cleanUrls`, and sets `trailingSlash: false`.

**Internal links and assets must be root-absolute** (e.g. `/sprint1/market-research.html`, `/assets/pdfs/...`). Relative sibling links break when Vercel serves `/sprint1` without a trailing slash (`market-research.html` resolves to `/market-research` → 404), so PDF pages look missing.

Live (JoeMota): https://damn-parking-pm-theta.vercel.app, also mirrored at https://damn-parking-pm.vercel.app (SaulBurns). If a Vercel project was previously set to Preact, merge this config (or clear the dashboard Build Command) so deploy no longer runs `preact build`.

### Tests / CI

```bash
python3 scripts/smoke_test.py
# or
npm test
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on pull requests and pushes to `main`: required pages/PDFs, PDF link parity, HTML structure, static server HTTP 200 smoke, and vercel.json static guards.

## Site map

| Page | Path |
|------|------|
| Home | `index.html` |
| About Us | `about/` |
| Sprint 1 | `sprint1/` |
| Market Research | `sprint1/market-research.html` (+ PDFs) |
| Business Strategy | `sprint1/business-strategy.html` (+ PDF) |
| Project Charter | `sprint1/project-charter.html` (+ PDF) |
| Retrospective | `sprint1/retrospective.html` (+ PDF) |
| Contributions & AI | `sprint1/contributions.html` (+ PDF) |
| Sprint 2 (slot) | `sprint2/` |

PDFs live in `assets/pdfs/`. Each Sprint 1 document page embeds a scrollable on-page viewer (~80vh) and a download button. Peer evaluations stay off this site.

## Team notes

- Keep web text and PDFs in sync every sprint.
- From Sprint 2 onward, add a change log on each sprint page.

## Stack

- Static HTML + CSS
- Three.js (ES module CDN) for the parking visualization
- No build step required
