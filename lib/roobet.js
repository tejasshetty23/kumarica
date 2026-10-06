/*
 * Roobet affiliate API → leaderboard data.
 * Shared by server.js (local) and api/leaderboard.js (Vercel).
 * Reads ROOBET_API_KEY (and optionally ROOBET_USER_ID) from the environment.
 */
const TOP_N = 10;
const CACHE_MS = () => (Number(process.env.CACHE_MINUTES) || 5) * 60 * 1000;

// Values still holding the .env.example placeholder text count as blank.
function envValue(name) {
  const v = (process.env[name] || "").trim();
  return v.startsWith("your_") ? "" : v;
}

// The user ID is optional: Roobet's key is a JWT that carries it, so when
// ROOBET_USER_ID is left blank it is read out of the key's payload.
function userIdFromKey(key) {
  const parts = key.split(".");
  if (parts.length !== 3) return "";
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    for (const name of ["userId", "uid", "user_id", "id", "sub"]) {
      if (claims[name]) return String(claims[name]);
    }
  } catch {}
  return "";
}

function credentials() {
  const apiKey = envValue("ROOBET_API_KEY");
  const userId = envValue("ROOBET_USER_ID") || userIdFromKey(apiKey);
  return { apiKey, userId, userIdSource: envValue("ROOBET_USER_ID") ? "env" : "key" };
}

// Current month in UTC. Roobet takes plain YYYY-MM-DD dates, read as UTC, with
// both ends inclusive — so the range is the 1st through the month's last day.
// `endsAt` (start of next month) is only used for the countdown.
function monthRange() {
  const n = new Date();
  const y = n.getUTCFullYear(), m = n.getUTCMonth();
  const day = (d) => d.toISOString().slice(0, 10);
  return {
    startDate: day(new Date(Date.UTC(y, m, 1))),
    endDate: day(new Date(Date.UTC(y, m + 1, 0))),
    endsAt: new Date(Date.UTC(y, m + 1, 1)).toISOString(),
  };
}

// One call to Roobet; returns the raw rows plus the range that was asked for.
async function fetchRoobetRows() {
  const { apiKey, userId } = credentials();
  if (!apiKey || !userId) {
    throw new Error(apiKey
      ? "Couldn't find a user ID in ROOBET_API_KEY; set ROOBET_USER_ID"
      : "ROOBET_API_KEY is not set");
  }
  const range = monthRange();
  const url = new URL("https://roobetconnect.com/affiliate/v2/stats");
  url.searchParams.set("userId", userId);
  url.searchParams.set("startDate", range.startDate);
  url.searchParams.set("endDate", range.endDate);

  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Roobet API responded ${res.status}: ${body}`);
  }
  const raw = await res.json();
  const rows = Array.isArray(raw) ? raw : raw.data;
  if (!Array.isArray(rows)) throw new Error("Roobet returned an unexpected payload");
  return { rows, range };
}

// "Kangaroo" -> "Ka***oo"
function mask(name = "") {
  if (name.length <= 4) return name[0] + "***";
  return name.slice(0, 2) + "***" + name.slice(-2);
}

let cache = { at: 0, data: null };

async function getLeaderboard() {
  if (cache.data && Date.now() - cache.at < CACHE_MS()) return cache.data;

  const { rows, range } = await fetchRoobetRows();

  const players = rows
    .map((p) => ({
      name: mask(p.username),
      // Ranked on Roobet's RTP-weighted figure, never the raw stake
      wagered: Number(p.weightedWagered) || 0,
    }))
    .filter((p) => p.wagered > 0)
    .sort((a, b) => b.wagered - a.wagered)
    .slice(0, TOP_N);

  const data = { updatedAt: new Date().toISOString(), endsAt: range.endsAt, players };
  cache = { at: Date.now(), data };
  return data;
}

// Last good result, for serving stale data when Roobet is down.
const cachedLeaderboard = () => cache.data;

module.exports = { getLeaderboard, cachedLeaderboard, fetchRoobetRows, credentials, mask };
