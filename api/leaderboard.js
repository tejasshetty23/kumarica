// Vercel serverless function: GET /api/leaderboard
// Set ROOBET_API_KEY in Vercel → Project → Settings → Environment Variables.
const { getLeaderboard, cachedLeaderboard } = require("../lib/roobet");

module.exports = async (req, res) => {
  try {
    const data = await getLeaderboard();
    // Vercel's CDN holds the response for 5 minutes, so Roobet is called at
    // most once per 5 minutes however many people load the page.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (err) {
    console.error("[leaderboard]", err.message);
    const stale = cachedLeaderboard();
    if (stale) return res.status(200).json(stale);
    res.status(502).json({ error: "Leaderboard unavailable" });
  }
};
