# Deployment Guide (Phase 10)

## 1. MongoDB Atlas

1. Create a free/shared cluster at https://cloud.mongodb.com.
2. Database Access → add a user with a strong password.
3. Network Access → allow access from your backend host's IP (or
   `0.0.0.0/0` for MVP simplicity, tightened later).
4. Copy the connection string into `MONGODB_URI` (backend env var).
5. From your machine (or the deployed backend's console), run:
   ```bash
   npm run seed:templates
   ```
   You should see three `[seed] upserted "..."` lines.

## 2. Backend → Render.com or Railway (Docker)

Puppeteer needs a real Chromium binary plus system libraries, so deploy the
backend as a **Docker** service using `backend/Dockerfile` (already set up
to install Chromium via apt and point Puppeteer at it) rather than a plain
Node buildpack.

**Render.com**
1. New → Web Service → connect this repo.
2. Runtime: **Docker**. Dockerfile path: `backend/Dockerfile`. Docker build
   context (root directory): `backend`.
3. Set all backend env vars from `backend/.env.example` in the Render
   dashboard (Environment tab) — `MONGODB_URI`, `JWT_SECRET`,
   `GEMINI_API_KEY`, `CLOUDINARY_*`, `FRONTEND_ORIGIN`.
4. Health check path: `/api/health`.
5. Deploy, then run the seed script once via Render's Shell tab:
   `npm run seed:templates`.

**Railway** — equivalent: New Project → Deploy from repo → set the root
directory to `backend` so it finds the Dockerfile there → set the same env
vars under Variables.

Either way, note the deployed backend URL (e.g.
`https://poster-maker-api.onrender.com`).

## 3. Frontend → Vercel

1. New Project → import this repo.
2. **Root Directory**: `frontend` (this is a monorepo — Vercel needs this
   set explicitly in the project's Settings → General, or in a
   `frontend/vercel.json` if you prefer as-code config).
3. Framework preset: Next.js (auto-detected).
4. Env var: `NEXT_PUBLIC_API_URL` = `https://<your-backend-url>/api`
5. Deploy. Note the deployed frontend URL (e.g.
   `https://poster-maker.vercel.app`).

## 4. Wire CORS

Go back to the backend's env vars and set:
```
FRONTEND_ORIGIN=https://poster-maker.vercel.app
```
Redeploy the backend so `cors()` in `app.ts` allows the real frontend
origin (it was `http://localhost:3000` during local dev).

## 5. Smoke test the deployed flow end-to-end

1. Visit the Vercel URL → register an account → confirm redirect to
   `/create`.
2. Pick an occasion → confirm templates load (seed script ran in step 1).
3. Fill the form, upload 1–3 photos → submit.
4. Confirm the `/posters/:id` page polls and eventually shows either a
   completed poster or a clear failure message.
5. Download the PNG; confirm it opens and text is correctly spelled.
6. Check `/history` shows the poster; delete it and confirm it disappears.

If step 3 fails immediately, check the Render/Railway logs first — the
most common issues are a missing `GEMINI_API_KEY` (should gracefully fall
back, not fail the whole poster) or Cloudinary credentials.
