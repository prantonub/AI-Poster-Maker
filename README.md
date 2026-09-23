# AI Political Poster Maker

Full-stack platform for generating ready-to-print political posters
(victory day, tribute, campaign, festival greetings) from a form.

Pipeline: **Gemini (styling JSON only) → HTML/CSS template → Puppeteer → PNG**.
Gemini never renders final text pixels — all Bangla text is drawn by the
HTML template so spelling is always exact.

## Structure

```
/frontend   Next.js 14 (TypeScript, App Router, Tailwind)
/backend    Express (TypeScript) + MongoDB/Mongoose
/shared     Shared TS types used by both apps
```

## Prerequisites

- Node.js 18+
- npm 9+ (workspaces)
- A MongoDB connection string (local `mongod` or MongoDB Atlas)
- (Later phases) Gemini API key, Cloudinary credentials

## Setup

```bash
npm install   # installs all three workspaces from the repo root

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# then fill in MONGODB_URI and JWT_SECRET in backend/.env at minimum
```

## Run (dev)

Two terminals from the repo root:

```bash
npm run dev:backend    # http://localhost:4000  (GET /api/health to check)
npm run dev:frontend   # http://localhost:3000
```

## Seed starter templates

Once Phase 5 lands:

```bash
npm run seed:templates
```

## Status

- [x] Phase 1 — Project scaffolding (this increment)
- [ ] Phase 2 — Data models (Mongoose schemas scaffolded ahead of schedule;
      see `backend/src/models/`)
- [ ] Phase 3 — Auth
- [ ] Phase 4 — File upload
- [ ] Phase 5 — Template system
- [ ] Phase 6 — Gemini integration (styling only)
- [ ] Phase 7 — Poster generation pipeline
- [ ] Phase 8 — Frontend pages
- [ ] Phase 9 — Rate limiting & hardening
- [ ] Phase 10 — Deploy
