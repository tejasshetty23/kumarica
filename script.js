/* =========================================================
   LEADERBOARD CONFIG
   Live data comes from /api/leaderboard (server.js → Roobet API).
   SAMPLE_PLAYERS is only shown if the API isn't reachable
   (e.g. opening index.html directly without the server).
   ========================================================= */
const PRIZE_POOL = 1000;

// Leaderboard ends at the end of the current month (local time).
// To use a fixed date instead: new Date("2026-10-31T23:59:59Z")
const now = new Date();
let END_DATE = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

const PRIZES = [400, 200, 125, 80, 60, 40, 35, 25, 20, 15];

const SAMPLE_PLAYERS = [
  { name: "Ka***ro",  wagered: 184520.4 },
  { name: "Vo***on",  wagered: 132904.1 },
  { name: "Ne***ix",  wagered: 98211.75 },
  { name: "Sp***ky",  wagered: 64018.2 },
  { name: "Bl***az",  wagered: 51230.0 },
  { name: "Mo***ey",  wagered: 40876.55 },
  { name: "Gr***ch",  wagered: 31422.9 },
  { name: "Lu***y7",  wagered: 22908.3 },
  { name: "Ze***th",  wagered: 15670.0 },
  { name: "Ro***ie",  wagered: 9844.1 },
];

/* ========================================================= */

const usd = (n, dp = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function renderLeaderboard(players) {
  document.getElementById("prizePool").textContent = usd(PRIZE_POOL, 0);

  // Always show 10 places, padding empty ones
  const list = players.slice(0, PRIZES.length);
  while (list.length < PRIZES.length) list.push({ name: "—", wagered: 0 });

  const rows = list
    .slice()
    .sort((a, b) => b.wagered - a.wagered)
    .map((p, i) => ({ ...p, rank: i + 1, prize: PRIZES[i] ?? 0 }));

  // Podium order: 2nd, 1st, 3rd (rank number + crown are part of the frame art)
  const podium = [rows[1], rows[0], rows[2]]
    .filter(Boolean)
    .map(
      (p) => `
      <article class="pcard pcard--${p.rank} reveal">
        <div class="pcard__body">
          <div class="pcard__avatar">${p.name[0]}</div>
          <div class="pcard__name">${p.name}</div>
          <div class="pcard__wager-lbl">Wagered</div>
          <div class="pcard__wager">${usd(p.wagered)}</div>
          <div class="pcard__prize"><span class="grad-text">${usd(p.prize, 0)}</span></div>
        </div>
      </article>`
    )
    .join("");
  document.getElementById("podium").innerHTML = podium;

  document.getElementById("tableBody").innerHTML = rows
    .slice(3)
    .map(
      (p) => `
      <div class="table__row">
        <span><span class="t-rank">${p.rank}</span></span>
        <span class="t-user">${p.name}</span>
        <span class="t-wager ta-r">${usd(p.wagered)}</span>
        <span class="t-prize ta-r grad-text">${usd(p.prize, 0)}</span>
      </div>`
    )
    .join("");
}

function startCountdown() {
  const cells = {};
  document.querySelectorAll(".countdown__num").forEach((el) => (cells[el.dataset.unit] = el));
  const pad = (n) => String(n).padStart(2, "0");

  const tick = () => {
    let diff = Math.max(0, END_DATE - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    cells.d.textContent = pad(d);
    cells.h.textContent = pad(h);
    cells.m.textContent = pad(m);
    cells.s.textContent = pad(s);
  };
  tick();
  setInterval(tick, 1000);
}

function setupUI() {
  // Nav background on scroll
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  const links = document.getElementById("navLinks");
  const toggle = document.getElementById("navToggle");
  const setMenu = (open) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // Copy code
  const copyBtn = document.getElementById("copyCode");
  const copyLabel = document.getElementById("copyLabel");
  let copyTimer;
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText("KUMARICA"); } catch (_) {}
    copyBtn.classList.add("is-copied");
    copyLabel.textContent = "COPIED";
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyLabel.textContent = "KUMARICA";
    }, 1600);
  });

  // Reveal on scroll
  document.querySelectorAll(".section__head, .table").forEach((el) => el.classList.add("reveal"));
  io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { threshold: 0.15 }
  );
  observeReveals();

  document.getElementById("year").textContent = new Date().getFullYear();
}

async function loadLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data.endsAt) END_DATE = new Date(data.endsAt);
    renderLeaderboard(data.players || []);
  } catch (_) {
    renderLeaderboard(SAMPLE_PLAYERS);
  }
  observeReveals();
}

let io;
function observeReveals() {
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
}

setupUI();
renderLeaderboard(SAMPLE_PLAYERS.map((p) => ({ ...p, name: "—", wagered: 0 })));
loadLeaderboard();
setInterval(loadLeaderboard, 5 * 60 * 1000);
startCountdown();
