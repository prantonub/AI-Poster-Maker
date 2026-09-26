# AI Political Poster Maker

A full-stack web platform for Bangladeshi political workers, committee members, and publicity agents to generate ready-to-print political posters — victory day, condolence/tribute, campaign, festival greetings, and Eid — by filling a simple form and letting AI compose the poster layout automatically.

## How it works

Bangla text rendered directly by an AI image-generation model is often misspelled or malformed, so this project deliberately avoids that approach. Instead:

1. **Gemini** is called only to suggest styling — a color palette, decorative motif, photo arrangement, and headline weight — never to generate final pixels or text.
2. The actual poster is rendered server-side from a hand-built **HTML/CSS template**, populated with the user's exact text and uploaded photos plus the AI-suggested styling.
3. The page is converted to a print-resolution **PNG via Puppeteer**.

This guarantees pixel-perfect, correctly-spelled Bangla text every time, while still giving each poster AI-personalized styling.

## Features

- Email/password authentication (JWT)
- Multi-step poster creation wizard: occasion → template → details → photos
- 5 unique, illustrated poster templates: বিজয় দিবস, শোক/স্মরণ, নির্বাচনী প্রচার, উৎসব শুভেচ্ছা, ঈদ/উৎসব
- Async generation pipeline with live status polling and a capped regenerate option
- Poster history with pagination and delete
- Forced PNG download
- Admin panel — platform stats, user/poster/template management, Gemini usage logs
- "One prompt, 5 banners" homepage demo — preview every template's style from a single headline
- Rate limiting, input validation, and text sanitization throughout

## Tech stack

- **Frontend:** Next.js 14 (TypeScript, App Router), Tailwind CSS
- **Backend:** Express (TypeScript), MongoDB + Mongoose
- **AI:** Google Gemini API (styling suggestions only)
- **Rendering:** Puppeteer (HTML/CSS → PNG), a singleton browser instance reused across every job
- **File storage:** Cloudinary
- **Auth:** JWT (email/password)


## Prerequisites

- Node.js 18+
- npm 9+
- A MongoDB connection string (local `mongod` or MongoDB Atlas)
- A Gemini API key
- A Cloudinary account (cloud name, API key, API secret)

## Setup

```bash
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# fill in MONGODB_URI, JWT_SECRET, HF_API_KEY, and CLOUDINARY_* in backend/.env
```

## Running locally

In two separate terminals:

```bash
cd backend && npm run dev     # http://localhost:4000
cd frontend && npm run dev    # http://localhost:3000
```

Seed the starter templates once (safe to re-run):

```bash
cd backend && npm run seed:templates
```

## Admin access

Register a normal account through the app, then promote it:

```bash
cd backend && npm run make:admin -- your-email@example.com
```

Log out and back in, then visit `/admin`.

## Admin panel

A full management console lives at `/admin`, split into seven sections:

| Section | What it does |
| --- | --- |
| **ড্যাশবোর্ড** | KPIs, 7/14/30/90-day activity chart, poster-status donut, occasion distribution, most-active users, and alerts when the platform is in maintenance |
| **ব্যবহারকারী** | Search/filter/sort/paginate every account; edit profile fields, change roles, suspend/reactivate, reset passwords, delete (cascading to their posters + logs), and bulk actions with selection |
| **পোস্টার** | Every user's posters with status/occasion/text filters, thumbnails, manual status override, admin-triggered regeneration, bulk delete, and CSV export (BOM-tagged so Bengali opens correctly in Excel) |
| **টেমপ্লেট** | Full template CRUD, activate/deactivate, duplicate (created inactive), usage counts, and a warning when a template's backing HTML file is missing on disk |
| **লগ ও অডিট** | AI generation logs with success-rate/latency/token summaries and retention purging, plus the admin audit trail of who changed what, when, and from which IP |
| **সেটিংস** | Runtime platform controls that take effect immediately, no redeploy: maintenance mode, registration toggle, generation kill-switch (to cap Hugging Face spend), site-wide notice, support email, per-user daily poster limit |
| **সিস্টেম** | Server uptime/memory, database status and collection counts, environment-readiness checks, a live Puppeteer health probe, stuck-poster reset, and index rebuild |

Safety rules enforced server-side:

- Admin rights are re-checked in the database on **every** admin request, so a demoted or suspended admin's still-valid JWT stops working immediately.
- An admin cannot suspend, demote, or delete their own account, and the last active admin cannot be removed.
- Deleting a user cascades to their posters and generation logs.
- Deleting a template is refused while posters still reference it (deactivate instead).
- Every mutating admin action writes an `AuditLog` entry with the acting admin, IP, and a before/after summary.

## Deployment

LIVE:
