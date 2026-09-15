# Damn Parking — Living Project Portal

UTEP **CS 4390 / 5388 Software Project Management** deliverable: a public Living Project Portal for **Damn Parking**, a campus computer-vision concept that turns lot cameras into a live open-stall signal.

This repository is the website source (static HTML/CSS/JS). The 3D lot on the home page is a cinematic visualization — not a production CV system.

## Run locally

```bash
# from repo root
python3 -m http.server 8080
# open http://localhost:8080
```

Or use any static host (GitHub Pages, Netlify, Vercel). Point Pages at `/` (root).

## Site map

| Page | Path |
|------|------|
| Home | `index.html` |
| About Us | `about/` |
| Sprint 1 | `sprint1/` |
| Market Research | `sprint1/market-research.html` (+ PDF) |
| Business Strategy | `sprint1/business-strategy.html` (+ PDF) |
| Project Charter | `sprint1/project-charter.html` (+ PDF) |
| Contributions & AI | `sprint1/contributions.html` (+ PDF) |
| Sprint 2 (slot) | `sprint2/` |

PDFs live in `assets/pdfs/`. Sprint retrospectives and peer evaluations are **not** on this site (Blackboard only).

## Team notes

- Replace placeholder names on About Us / contribution statement with your real roster.
- Keep web text and PDFs in sync every sprint.
- From Sprint 2 onward, add a change log on each sprint page.

## Stack

- Static HTML + CSS
- Three.js (ES module CDN) for the parking visualization
- No build step required
