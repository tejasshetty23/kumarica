# Kumarica — Roobet Leaderboard

## Run locally
1. Copy `.env.example` to `.env` and fill in `ROOBET_API_KEY` and `ROOBET_USER_ID` (from Roobet's affiliate dashboard → API).
2. `node server.js --check` to confirm the key works: it calls Roobet once and prints the date range, how many players came back, and their weighted vs raw wager.
3. `node server.js` (Node 18+, no install needed)
4. Open http://localhost:3000

Without API keys the site shows sample leaderboard data.

## Editing
- Prize pool / payouts: `PRIZE_POOL` and `PRIZES` at the top of `script.js`
- Social / Roobet links: `index.html`
- Colors: CSS variables at the top of `styles.css`
- Images: `assets/logo.png`, `assets/avatar.png` (background-removed versions of the originals)

## Deploying to Vercel
The site deploys as-is: Vercel serves the static files, and `api/leaderboard.js` runs as a serverless function (it shares `lib/roobet.js` with `server.js`).

1. Vercel → your project → **Settings → Environment Variables**.
2. Add `ROOBET_API_KEY` with your key, tick **Production** and **Preview**, Save. (`ROOBET_USER_ID` is optional; it's read from the key.)
3. **Deployments** → latest deployment → **⋯ → Redeploy**. Env changes only apply to new deployments.
4. Check `https://<your-site>/api/leaderboard` returns JSON with `players`.

Responses are cached on Vercel's CDN for 5 minutes, so Roobet is called at most once per 5 minutes.
