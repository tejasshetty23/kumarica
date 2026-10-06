# Kumarica — Roobet Leaderboard

## Run locally
1. Copy `.env.example` to `.env` and fill in `ROOBET_API_KEY` and `ROOBET_USER_ID` (from Roobet's affiliate dashboard → API).
2. `node server.js` (Node 18+, no install needed)
3. Open http://localhost:3000

Without API keys the site shows sample leaderboard data.

## Editing
- Prize pool / payouts: `PRIZE_POOL` and `PRIZES` at the top of `script.js`
- Social / Roobet links: `index.html`
- Colors: CSS variables at the top of `styles.css`
- Images: `assets/logo.png`, `assets/avatar.png` (background-removed versions of the originals)

## Deploying
Needs a host that runs Node (Render, Railway, a VPS, etc.) so the API key stays server-side. Set the same env vars there.
