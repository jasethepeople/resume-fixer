# AI Resume Fixer

A client-side React + Vite app that analyzes a resume against a job description for ATS (applicant tracking system) issues — keyword coverage, missing keywords, and formatting red flags — then suggests optimized wording. Monetized with a paywall: 2 free scans, then $1.99 / $4.99-mo / $12.99-lifetime tiers.

## Features

- **Resume analysis**: keyword extraction, ATS issue detection, weighted resume-vs-job-description keyword matching (`extractKeywords`, `detectATSIssues`, `weightedMatch`, `optimizeResume` in `src/App.tsx`)
- **Results UI**: match-score donut, missing-keyword list, optimized resume text, drag-and-drop resume paste
- **Paywall**: 2 free scans, then a pricing modal; Pro unlock persisted via a localStorage signature (`fixer_pro_<scans>_v3`)
- **Payment wiring (not live)**: `PAYMENT_PROVIDER` switch in `App.tsx` is currently `'mock'`; Stripe, Lemon Squeezy, and Paddle integrations are coded (`api/checkout.js`, `api/lemon-checkout.js`, `api/paddle-checkout.js`, `api/webhook.js`) but disabled (`USE_STRIPE/USE_LEMON/USE_PADDLE = false`, placeholder price/variant IDs)
- Standalone single-file variant: `Ai-Resume-Fixer.html`

## Tech stack

- React + TypeScript + Vite, Tailwind (`src/index.css`)
- Vercel serverless functions for checkout/webhooks (`vercel.json`)
- Pure client-side analysis — no backend, no database, no AI API calls

## Getting started

```bash
npm install
npm run dev      # Vite dev server
npm run build    # vite build → dist/
```

Deploy: `vercel --prod` (per repo notes). Going live with real payments requires setting the provider flags in `src/App.tsx`, real price/variant IDs, and the corresponding env keys (`STRIPE_SECRET_KEY`, `LEMON_*`, `PADDLE_*`).

## Project structure

```
├── src/App.tsx          # entire app: analysis logic, results UI, paywall (1071 lines)
├── src/main.tsx, src/index.css
├── api/                 # checkout.js, lemon-checkout.js, paddle-checkout.js, webhook.js
├── Ai-Resume-Fixer.html # standalone single-file version
├── index.html           # title: "AI Resume Fixer - ATS Optimized $1.99"
└── vercel.json, vite.config.ts
```

## Status

**Real, working demo.** The analysis runs entirely in the browser and works offline; the paywall currently unlocks via the mock provider. All payment integrations are pre-wired but not activated, and the pricing math in the repo's notes is the author's own fee comparison, not audited. The existing README is deployment/payment notes rather than a project overview — this replaces it.
