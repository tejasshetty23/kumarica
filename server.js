/*
 * Kumarica leaderboard server
 * - Serves the static site
 * - GET /api/leaderboard → proxies the Roobet affiliate API (keeps your API key private)
 *   (the Roobet logic lives in lib/roobet.js; on Vercel, api/leaderboard.js uses it)
 *
 * Run:    node server.js           (Node 18+, no npm install needed)
 * Check:  node server.js --check   (calls Roobet once and reports what came back)
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
const { getLeaderboard, cachedLeaderboard, fetchRoobetRows, credentials, mask } = require("./lib/roobet");

// `node server.js --check`: verify the key and the weighted field, then exit.
if (process.argv.includes("--check")) {
  (async () => {
    try {
      const { rows, range } = await fetchRoobetRows();
      const { userId, userIdSource } = credentials();
      console.log(`    user ID: ${userId} (${userIdSource === "env" ? "from .env" : "read from the key"})`);
      console.log(`OK  key accepted. Range ${range.startDate} → ${range.endDate}, ${rows.length} player row(s).`);
      if (!rows.length) {
        console.log("    No wagers under your code in this range yet, so the board will be empty.");
        return;
      }
      const withWeighted = rows.filter((r) => typeof r.weightedWagered === "number").length;
      console.log(`    weightedWagered present on ${withWeighted}/${rows.length} rows.`);
      console.log("    Fields on a row:", Object.keys(rows[0]).join(", "));
      const top = [...rows].sort((a, b) => (b.weightedWagered || 0) - (a.weightedWagered || 0)).slice(0, 5);
      console.log("    Top 5 by weighted wager (raw wager alongside):");
      for (const r of top) {
        console.log(`      ${mask(r.username).padEnd(10)} weighted ${Number(r.weightedWagered || 0).toFixed(2).padStart(12)}   raw ${Number(r.wagered || 0).toFixed(2).padStart(12)}`);
      }
    } catch (err) {
      console.error("FAIL", err.message);
      process.exitCode = 1;
    }
  })();
  return;
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
      const stale = cachedLeaderboard();
      if (stale) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(stale));
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
