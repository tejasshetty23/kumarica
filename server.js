/*
 * Kumarica leaderboard server
 * - Serves the static site
 * - GET /api/leaderboard → proxies the Roobet affiliate API (keeps your API key private)
 *
 * Run:  node server.js     (Node 18+, no npm install needed)
 * Config lives in .env (copy .env.example → .env)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

// ---- tiny .env loader ----
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = Number(process.env.PORT) || 3000;
const ROOBET_API_KEY = process.env.ROOBET_API_KEY || "";
const ROOBET_USER_ID = process.env.ROOBET_USER_ID || "";
const CACHE_MS = (Number(process.env.CACHE_MINUTES) || 5) * 60 * 1000;
const TOP_N = 10;

// Current month in UTC: [start of month, start of next month)
function monthRange() {
  const n = new Date();
  const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));
  return { start, end };
}

// "Kangaroo" -> "Ka***oo"
function mask(name = "") {
  if (name.length <= 4) return name[0] + "***";
  return name.slice(0, 2) + "***" + name.slice(-2);
}

let cache = { at: 0, data: null };

async function getLeaderboard() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  if (!ROOBET_API_KEY || !ROOBET_USER_ID) {
    throw new Error("ROOBET_API_KEY / ROOBET_USER_ID not set in .env");
  }

  const { start, end } = monthRange();
  const url = new URL("https://roobetconnect.com/affiliate/v2/stats");
  url.searchParams.set("userId", ROOBET_USER_ID);
  url.searchParams.set("startDate", start.toISOString());
  url.searchParams.set("endDate", end.toISOString());

  const res = await fetch(url, { headers: { Authorization: `Bearer ${ROOBET_API_KEY}` } });
  if (!res.ok) throw new Error(`Roobet API responded ${res.status}`);
  const raw = await res.json();

  const players = (Array.isArray(raw) ? raw : raw.data || [])
    .map((p) => ({
      name: mask(p.username),
      // Ranked on Roobet's RTP-weighted figure, never the raw stake
      wagered: Number(p.weightedWagered) || 0,
    }))
    .filter((p) => p.wagered > 0)
    .sort((a, b) => b.wagered - a.wagered)
    .slice(0, TOP_N);

  const data = { updatedAt: new Date().toISOString(), endsAt: end.toISOString(), players };
  cache = { at: Date.now(), data };
  return data;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
// Only these get served — keeps .env and server.js private
const PUBLIC = new Set(["/index.html", "/styles.css", "/script.js"]);

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (pathname === "/api/leaderboard") {
    try {
      const data = await getLeaderboard();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error("[leaderboard]", err.message);
      // Serve stale data if we have it
      if (cache.data) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(cache.data));
      }
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Leaderboard unavailable" }));
    }
    return;
  }

  const file = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  if (!PUBLIC.has(file) && !file.startsWith("/assets/")) {
    res.writeHead(404); return res.end("Not found");
  }
  const full = path.join(__dirname, path.normalize(file));
  if (!full.startsWith(__dirname)) { res.writeHead(403); return res.end(); }

  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log(`Kumarica site running → http://localhost:${PORT}`));
