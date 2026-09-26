# AI Political Poster Maker

Full-stack platform for generating ready-to-print political posters
(victory day, tribute, campaign, festival greetings, Eid) from a form.

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
- Gemini API key, Cloudinary credentials (for full poster generation)

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

Seeds all 5 occasion templates (বিজয় দিবস, শোক/স্মরণ, নির্বাচনী প্রচার,
উৎসব শুভেচ্ছা, ঈদ/উৎসব). Safe to re-run — it upserts by title:

```bash
npm run seed:templates
```

## Make a user an admin

Register a normal account first through the app, then promote it by email:

```bash
npm run make:admin -- someone@example.com
```

They can then visit `/admin` (a link appears in the navbar automatically
once their account has the admin role) to see platform stats, browse all
users/posters, activate or deactivate templates, and inspect Gemini
generation logs.

## Status

- [x] Phase 1 — Project scaffolding
- [x] Phase 2 — Data models (`backend/src/models/`)
- [x] Phase 3 — Auth (register/login, JWT middleware, login/register pages,
      `AuthContext`, `ProtectedRoute`)
- [x] Phase 4 — File upload (`POST /api/upload`, Cloudinary, multer memory
      storage, 3 files / 5MB each, image-only)
- [x] Phase 5 — Template system (seed script + 3 real HTML/CSS templates)
- [x] Phase 6 — Gemini integration (styling suggestions only, TTL cache,
      defensive parsing, safe fallback)
- [x] Phase 7 — Poster generation pipeline (Gemini → HTML → Puppeteer →
      Cloudinary, async job + polling, regenerate with retry cap, history,
      delete)
- [x] Phase 8 — Frontend pages (landing, login/register, multi-step create
      wizard, polling preview, history grid — responsive throughout)
- [x] Phase 9 — Rate limiting & hardening (per-user rate limit on poster
      creation, zod validation on every POST body, Cloudinary-only photo
      URLs, text sanitization + Handlebars auto-escaping against injection)
- [x] Phase 10 — Deploy (see [DEPLOYMENT.md](./DEPLOYMENT.md) for the full
      MongoDB Atlas + Render/Railway (Docker) + Vercel walkthrough)

All 10 original phases are complete. See DEPLOYMENT.md when you're ready to ship.

## Post-MVP additions

Beyond the original 10-phase plan, the following have since been added:

- **5 unique occasion templates** instead of 3 — `victory-day.html`,
  `tribute.html`, `campaign.html`, `greeting.html`, `eid-festival.html`
  (`backend/src/templates/`), each with a distinct illustrated composition
  rather than palette-swapped copies of one layout.
- **Admin panel** (`/admin`, admin-only) — platform stats, user/poster/
  template browsing, template activate/deactivate, Gemini generation-log
  inspection. Backed by `backend/src/routes/admin.ts`.
- **Forced PNG download** — the preview page fetches the image as a blob
  and triggers a real download, since the plain `<a download>` attribute is
  silently ignored by browsers for cross-origin (Cloudinary) URLs.
- **"One prompt, 5 banners" homepage demo** — `POST /api/posters/quick-preview`
  renders a lightweight preview in every active template's style from a
  single headline, without saving anything to poster history. Tightly rate
  limited (3 per 30 min per user) since it runs up to 5 Puppeteer screenshots
  per call.
- **Navbar** (`components/Navbar.tsx`) — persistent header with home/create/
  history links, an admin link (shown only to admins), and login/register or
  user-badge/logout depending on auth state.
