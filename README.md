# AI Poster Maker

A full-stack web platform that lets Bangladeshi workers, committee members, and publicity agents produce ready-to-print  posters — victory day, condolence/tribute, campaign, festival greetings, and Eid — from a short form, with the layout composed automatically.

**Live :** https://ai-poster-maker-prantonub.vercel.app

---


## How it works

Asking a diffusion model to draw Bangla text produces misspelled, malformed lettering. This project avoids that approach entirely:

1. **A text model suggests styling only** — a colour palette, decorative motif, photo arrangement, and headline weight. It never generates final pixels or text.
2. **The poster is rendered server-side** from a hand-built HTML/CSS template, populated with the user's exact text, uploaded photos, and the suggested styling.
3. **The page is screenshotted to a print-resolution PNG** via Puppeteer (1200 × 1600).

The result is correctly-spelled, properly shaped Bangla text on every poster, while still giving each one AI-personalised styling.

> **Note on naming:** some database fields and identifiers still use `gemini*` (e.g. `geminiPromptUsed`, `lastGeminiSuggestion`) from an earlier provider. These are legacy names only — the active provider is the Hugging Face Inference API, configured with `HF_API_KEY`.

---

## Features

### For users

- Email/password authentication with JWT sessions
- Multi-step creation wizard: occasion → template → details → photos
- 5 illustrated templates: বিজয় দিবস, শোক/স্মরণ, নির্বাচনী প্রচার, উৎসব শুভেচ্ছা, ঈদ/উৎসব
- AI banner generator with 1:1, 4:5, 9:16, and 16:9 aspect ratios
- Prompt-based editing of previously generated posters
- Async generation with live status polling and capped regeneration
- Poster history with pagination and delete
- Forced PNG download
- "One prompt, 5 banners" homepage demo — every template's style from a single headline

### Platform

- Full admin console (see admin-panel)
- Runtime platform switches: maintenance mode, registration toggle, generation kill-switch
- Audit trail of every administrative action
- Rate limiting, input validation, and text sanitisation throughout

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (TypeScript, App Router), Tailwind CSS |
| Backend | Express (TypeScript), Zod validation |
| Database | MongoDB with Mongoose |
| AI | Hugging Face Inference API — Stable Diffusion 3 for artwork, a text model for styling suggestions |
| Rendering | Puppeteer (HTML/CSS → PNG), a singleton Chromium instance shared across all jobs |
| File storage | Cloudinary |
| Auth | JWT (email/password) |

---

## Prerequisites

- **Node.js 18+**
- **npm 9+**
- A **MongoDB** connection string (local `mongod` or MongoDB Atlas)
- A **Hugging Face** API token with *Inference Providers* permission
- A **Cloudinary** account (cloud name, API key, API secret)

---

## Running locally

Two terminals:

```bash
npm run dev:backend     # http://localhost:4000
npm run dev:frontend    # http://localhost:3000
```

Or per workspace:

```bash
cd backend  && npm run dev
cd frontend && npm run dev
```

Seed the starter templates once (idempotent, safe to re-run):

```bash
npm run seed:templates
```

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev:backend` | Start the API with hot reload |
| `npm run dev:frontend` | Start the Next.js dev server |
| `npm run seed:templates` | Upsert the 5 starter templates |
| `cd backend && npm run make:admin -- <email>` | Promote a user to admin |
| `cd backend && npm run migrate:users` | Backfill admin-panel fields on older accounts |
| `cd backend && npm run build` / `npm start` | Production build and run |

---

## Admin access

Register a normal account through the app, then promote it:

```bash
cd backend && npm run make:admin -- your-email@example.com
```

Log out and back in, then visit `/admin`.

Visiting `/admin` while signed out redirects to the login page with a return path, so signing in lands you back in the panel. Non-admin accounts are refused.

---

### Admin Panel

A comprehensive management console available at `/admin`, featuring:

* **Dashboard:** View key metrics, activity trends, poster statistics, popular occasions, active users, and system alerts.
* **User Management:** Search, filter, sort, paginate, edit accounts, manage roles, suspend/reactivate users, reset passwords, delete accounts, and perform bulk actions.
* **Poster Management:** Browse and filter all posters, preview thumbnails, update statuses, regenerate posters, bulk delete, and export data to Excel-friendly CSV.
* **Template Management:** Create, edit, duplicate, activate/deactivate, and monitor template usage, with missing-file detection.
* **Logs & Audit:** Track generation performance, success rates, latency, token usage, data retention, and detailed admin activity.
* **Platform Settings:** Manage maintenance mode, registration, generation controls, site-wide notices, support email, and user poster limits in real time.
* **System Monitoring:** Monitor server and database health, environment readiness, Puppeteer status, stuck generations, and database indexes.

---

## Deployment LIVE:

- **Frontend** https://ai-poster-maker-prantonub.vercel.app/
- **Backend** https://ai-poster-maker-prantonub.onrender.com/
- **Admin Panel** https://ai-poster-maker-prantonub.vercel.app/admin
- email: admin@gmail.com 
- password: admin123
