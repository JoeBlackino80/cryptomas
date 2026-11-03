/* ============================================================
 * Orbit Rush — verification server + daily leaderboard (alpha)
 *
 * A run submission is just (pid, name, day, taps[]). The server
 * re-simulates the deterministic game from the daily seed and the
 * tap log, and the score IT computes is the only score that counts
 * — a client cannot claim a score it cannot reproduce.
 *
 * Standalone on purpose: no MongoDB / Solana secrets needed, so it
 * runs anywhere with `npm run orbit`. Storage is a JSON file; swap
 * the `store` for the Mongoose models in server.js at beta.
 *
 *   GET  /api/orbit/daily                 today's challenge info
 *   POST /api/orbit/run                   submit a run (verified)
 *   GET  /api/orbit/leaderboard[?day=]    top runs for a day
 *   GET  /                                serves the game itself
 * ============================================================ */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./sim.js";

const Sim = globalThis.OrbitSim;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LIMITS = {
  MAX_TAPS: 2000,           // > 30 taps/s sustained is not human
  NAME_RE: /^[A-Za-z0-9_-]{1,16}$/,
  PID_RE: /^[a-f0-9]{8,32}$/,
  RATE_WINDOW_MS: 60_000,   // per-IP submission rate limit
  RATE_MAX: 30,
  MIDNIGHT_GRACE_S: 120     // runs started just before UTC midnight
};

export function createApp(opts = {}) {
  const persist = opts.persist !== false;
  const dataDir = opts.dataDir || path.join(__dirname, "data");
  const dataFile = path.join(dataDir, "leaderboard.json");

  /* ---------- storage: { [day]: { [pid]: entry } } ---------- */
  let store = {};
  if (persist) {
    fs.mkdirSync(dataDir, { recursive: true });
    try { store = JSON.parse(fs.readFileSync(dataFile, "utf8")); } catch { store = {}; }
  }
  let saveTimer = null;
  function save() {
    if (!persist) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.writeFile(dataFile, JSON.stringify(store), (err) => {
        if (err) console.error("leaderboard save failed:", err.message);
      });
    }, 1000);
  }

  function topFor(day, limit = 10) {
    const entries = Object.values(store[day] || {});
    entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
    return entries.slice(0, limit)
      .map(e => ({ name: e.name, score: e.score, hops: e.hops, sparks: e.sparks }));
  }
  function rankFor(day, pid) {
    const day0 = store[day] || {};
    const me = day0[pid];
    if (!me) return null;
    let rank = 1;
    for (const e of Object.values(day0))
      if (e.score > me.score || (e.score === me.score && e.ts < me.ts)) rank++;
    return rank;
  }

  /* ---------- app ---------- */
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {                       // permissive CORS (alpha)
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") return res.end();
    next();
  });

  const hits = new Map();                             // naive per-IP rate limit
  function rateLimited(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < LIMITS.RATE_WINDOW_MS);
    arr.push(now); hits.set(ip, arr);
    return arr.length > LIMITS.RATE_MAX;
  }

  app.get("/api/orbit/daily", (req, res) => {
    const now = Date.now();
    const day = Sim.utcDay(now);
    const midnight = new Date(day + "T00:00:00Z").getTime() + 86400000;
    res.json({ day, number: Sim.dailyNumber(now), secondsLeft: Math.floor((midnight - now) / 1000) });
  });

  app.post("/api/orbit/run", (req, res) => {
    if (rateLimited(req.ip)) return res.status(429).json({ error: "slow down" });

    const { pid, name, day, taps, claimed } = req.body || {};

    // --- shape validation ---
    if (typeof pid !== "string" || !LIMITS.PID_RE.test(pid))
      return res.status(400).json({ error: "bad pid" });
    const cleanName = (typeof name === "string" && LIMITS.NAME_RE.test(name)) ? name : "guest";
    if (!Array.isArray(taps) || taps.length > LIMITS.MAX_TAPS)
      return res.status(400).json({ error: "bad taps" });
    for (let i = 0; i < taps.length; i++) {
      const t = taps[i];
      if (!Number.isInteger(t) || t < 0 || t >= Sim.MAX_TICKS || (i > 0 && t <= taps[i - 1]))
        return res.status(400).json({ error: "bad taps" });
    }

    // --- day validation (today, or yesterday within the midnight grace) ---
    const now = Date.now();
    const today = Sim.utcDay(now);
    const yesterday = Sim.utcDay(now - 86400000);
    const secsIntoToday = Math.floor((now - new Date(today + "T00:00:00Z").getTime()) / 1000);
    if (day !== today && !(day === yesterday && secsIntoToday < LIMITS.MIDNIGHT_GRACE_S))
      return res.status(400).json({ error: "day closed", day: today });

    // --- authoritative re-simulation ---
    const g = Sim.simulate(Sim.dailySeed(day), taps);
    const score = g.score;
    const mismatch = Number.isFinite(claimed) && claimed !== score;

    // --- leaderboard upsert (best per player per day) ---
    const dayStore = store[day] || (store[day] = {});
    const prev = dayStore[pid];
    const improved = !prev || score > prev.score;
    if (improved) {
      dayStore[pid] = { name: cleanName, score, hops: g.hops, sparks: g.sparksHit,
                        ticks: g.tick, end: g.endReason, ts: now };
    } else if (prev && prev.name !== cleanName) {
      prev.name = cleanName;
    }
    save();

    res.json({
      ok: true, day, score, mismatch, improved,
      best: dayStore[pid].score,
      rank: rankFor(day, pid),
      players: Object.keys(dayStore).length,
      top: topFor(day)
    });
  });

  app.get("/api/orbit/leaderboard", (req, res) => {
    const day = (typeof req.query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day))
      ? req.query.day : Sim.utcDay();
    const out = { day, players: Object.keys(store[day] || {}).length, top: topFor(day, 100) };
    const pid = req.query.pid;
    if (typeof pid === "string" && LIMITS.PID_RE.test(pid)) {
      out.rank = rankFor(day, pid);
      out.best = store[day]?.[pid]?.score ?? null;
    }
    res.json(out);
  });

  // serve the game itself (orbit-rush.html + sim.js)
  app.get("/", (req, res) => res.redirect("/orbit-rush.html"));
  app.use(express.static(__dirname));

  return app;
}

/* ---------- run directly: `npm run orbit` ---------- */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.ORBIT_PORT || 4100;
  createApp().listen(port, () => {
    console.log(`Orbit Rush server: http://localhost:${port}`);
    console.log(`Daily track: ${Sim.utcDay()} (#${Sim.dailyNumber()})`);
  });
}
