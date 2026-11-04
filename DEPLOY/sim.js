/* ============================================================
 * OrbitSim — deterministic simulation core for Orbit Rush.
 * Single source of truth, shared by:
 *   - the browser client (classic <script src="sim.js">)
 *   - the Node verification server (import './sim.js')
 *
 * Determinism contract:
 *   createState(seed) + the same sequence of step(G, tap) calls
 *   always produces the same state. A run is therefore fully
 *   described by (seed, taps[]) where taps are tick indices.
 *   No Math.random, no wall clock, no screen-size dependence.
 *
 *   NOTE: Math.sin/cos/atan2 are not bit-exact across JS engines
 *   in the last ulp. Chrome and Node share V8, so they match; for
 *   other engines the server's re-simulated score is authoritative
 *   (production TODO: fixed-point or polynomial trig).
 * ============================================================ */
(function (global) {
  "use strict";

  const TICK = 1 / 120;                  // simulation step (s)
  const RUN_SECONDS = 60;
  const MAX_TICKS = RUN_SECONDS * 120;   // 7200
  const VIEW_W = 400;                    // logical playfield width
  const LATCH_PAD = 16;                  // capture margin around a ring
  const FLIGHT_TIMEOUT_TICKS = 192;      // 1.6 s of free flight -> fall
  const RELATCH_DELAY_TICKS = 30;        // 0.25 s before re-latching same ring
  const FALL_DIST = 520;                 // fall this far below best height -> dead
  const ORB_R = 8, SPARK_R = 22, SPIKE_R = 11;
  const TRACK_ANCHORS = 160;
  const COMBO_CAP = 20;
  const CHECKPOINT_EVERY = 5;            // every 5th ring is a gate (checkpoint)
  const CP_BONUS = 50;                   // one-time bonus for reaching a new gate
  const RESPAWN_TICKS = 150;             // 1.25 s pause after death, then back to the gate

  /* ---------- seeded PRNG ---------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- calendar helpers (UTC day = one world-wide track) ---------- */
  const utcDay = (now) => new Date(now === undefined ? Date.now() : now).toISOString().slice(0, 10);
  const dailyNumber = (now) => Math.floor(((now === undefined ? Date.now() : now) / 86400000) - 20000);
  const dailySeed = (day) => hashStr("orbit-rush-" + day);

  /* ---------- track generation ---------- */
  function makeTrack(seed, count) {
    count = count || TRACK_ANCHORS;
    const rnd = mulberry32(seed);
    const anchors = [], sparks = [], segFirst = [];
    let x = 0, y = 0;
    for (let i = 0; i < count; i++) {
      const r = 38 + rnd() * 30;
      const cp = i > 0 && i % CHECKPOINT_EVERY === 0;
      const a = { x, y, r, w: (1.9 + rnd() * 1.1) * (rnd() < 0.5 ? 1 : -1), spike: -1, cp };
      // gates never carry spikes — respawning onto one must be safe
      if (i > 3 && !cp && rnd() < Math.min(0.12 + i * 0.004, 0.4)) a.spike = rnd() * Math.PI * 2;
      anchors.push(a);
      segFirst.push(sparks.length);
      const py = y, px = x;
      y -= 130 + rnd() * 90;
      x = Math.max(-140, Math.min(140, x + (rnd() * 2 - 1) * 150));
      if (i < count - 1) {
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const t = 0.3 + 0.5 * (k + rnd() * 0.6) / n;
          sparks.push({ x: px + (x - px) * t + (rnd() * 2 - 1) * 26,
                        y: py + (y - py) * t + (rnd() * 2 - 1) * 18, hit: false });
        }
      }
    }
    segFirst.push(sparks.length);
    return { anchors, sparks, segFirst };
  }

  /* ---------- state ---------- */
  function createState(seed) {
    const G = {
      seed, track: makeTrack(seed), tick: 0,
      state: "orbit", anchor: 0, angle: Math.PI / 2,
      x: 0, y: 0, vx: 0, vy: 0, flight: 0,
      score: 0, combo: 1, hops: 0, sparksHit: 0,
      maxAnchor: 0, checkpoint: 0, deaths: 0, respawn: 0,
      camY: 0, alive: true, done: false, endReason: null,
      events: []            // drained by the client each step, for juice only
    };
    syncOrb(G);
    return G;
  }
  function syncOrb(G) {
    const a = G.track.anchors[G.anchor];
    G.x = a.x + Math.cos(G.angle) * a.r;
    G.y = a.y + Math.sin(G.angle) * a.r;
  }
  function release(G) {
    if (G.state !== "orbit") return;
    const a = G.track.anchors[G.anchor];
    const speed = Math.max(Math.abs(a.w) * a.r, 150) * 1.45;
    const dir = a.w >= 0 ? 1 : -1;
    G.vx = -Math.sin(G.angle) * dir * speed;
    G.vy =  Math.cos(G.angle) * dir * speed;
    G.state = "fly"; G.flight = 0;
  }
  /* Death no longer ends the run: the orb respawns at the last gate after a
   * short pause. The cost of dying is time, a combo reset, and the climb back
   * (which scores nothing — see maxAnchor below). Only the timer ends a run. */
  function kill(G, reason) {
    G.alive = false; G.deaths++; G.combo = 1;
    G.state = "dead"; G.respawn = RESPAWN_TICKS; G.lastDeath = reason;
    G.events.push({ t: "die" });
    return G;
  }
  function respawnAtGate(G) {
    const a = G.track.anchors[G.checkpoint];
    G.anchor = G.checkpoint; G.angle = Math.PI / 2;
    G.state = "orbit"; G.alive = true; G.camY = a.y;
    syncOrb(G);
    G.events.push({ t: "respawn" });
  }

  /* ---------- one simulation tick; tap = input this tick ---------- */
  function step(G, tap) {
    if (G.events.length) G.events.length = 0;
    if (G.done) return G;
    if (tap) release(G);
    G.tick++;
    if (G.tick >= MAX_TICKS) { G.done = true; G.endReason = "time"; return G; }

    if (G.state === "dead") {              // respawn countdown — timer keeps running
      G.respawn--;
      if (G.respawn <= 0) respawnAtGate(G);
      return G;
    }

    const A = G.track.anchors;
    const lo = Math.max(0, G.anchor - 1), hi = Math.min(A.length, G.anchor + 6);

    if (G.state === "orbit") {
      G.angle += A[G.anchor].w * TICK;
      syncOrb(G);
    } else {
      G.flight++;
      if (G.flight > FLIGHT_TIMEOUT_TICKS) return kill(G, "fall");
      G.x += G.vx * TICK; G.y += G.vy * TICK;
      if (G.x < -VIEW_W / 2 - 40 || G.x > VIEW_W / 2 + 40 || G.y > G.camY + FALL_DIST)
        return kill(G, "oob");
      for (let i = lo; i < hi; i++) {
        if (i === G.anchor && G.flight < RELATCH_DELAY_TICKS) continue;
        const a = A[i], dx = G.x - a.x, dy = G.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d - a.r) < LATCH_PAD) {               // latch!
          const cross = dx * G.vy - dy * G.vx;             // keep travel direction
          a.w = Math.abs(a.w) * (cross >= 0 ? 1 : -1);
          if (i > G.maxAnchor) {                           // NEW territory only:
            G.maxAnchor = i;                               // re-climbing after a death
            G.hops++; G.combo = Math.min(G.combo + 1, COMBO_CAP);  // scores nothing,
            G.score += 10 * G.combo;                       // so dying can't be farmed
            if (a.cp && i > G.checkpoint) {
              G.checkpoint = i; G.score += CP_BONUS;
              G.events.push({ t: "checkpoint" });
            }
          }
          G.anchor = i; G.angle = Math.atan2(dy, dx); G.state = "orbit";
          syncOrb(G);
          G.events.push({ t: "latch" });
          break;
        }
      }
    }
    // sparks (only segments near the current anchor — identical result, O(1))
    const sf = G.track.segFirst;
    const s0 = sf[lo], s1 = sf[Math.min(sf.length - 1, G.anchor + 6)];
    for (let si = s0; si < s1; si++) {
      const s = G.track.sparks[si];
      if (s.hit) continue;
      const dx = G.x - s.x, dy = G.y - s.y;
      if (dx * dx + dy * dy < SPARK_R * SPARK_R) {
        s.hit = true; G.sparksHit++; G.score += 5 * G.combo;
        G.events.push({ t: "spark", x: s.x, y: s.y });
      }
    }
    // spike satellites (counter-rotate their anchor)
    for (let i = lo; i < Math.min(A.length, G.anchor + 6); i++) {
      const a = A[i];
      if (a.spike < 0) continue;
      a.spike -= a.w * 1.15 * TICK;
      const sx = a.x + Math.cos(a.spike) * a.r, sy = a.y + Math.sin(a.spike) * a.r;
      const dx = G.x - sx, dy = G.y - sy, rr = SPIKE_R + ORB_R;
      if (dx * dx + dy * dy < rr * rr) return kill(G, "spike");
    }
    if (G.y < G.camY) G.camY = G.y;
    return G;
  }

  /* ---------- headless re-simulation of a (seed, taps) run ---------- */
  function simulate(seed, taps, opts) {
    const maxTicks = Math.min((opts && opts.maxTicks) || MAX_TICKS, MAX_TICKS);
    const G = createState(seed);
    let p = 0;
    while (!G.done && G.tick < maxTicks) {
      let tap = false;
      if (p < taps.length && taps[p] === G.tick) { tap = true; p++; }
      step(G, tap);
    }
    return G;
  }

  const OrbitSim = {
    TICK, RUN_SECONDS, MAX_TICKS, VIEW_W, ORB_R, SPARK_R, SPIKE_R, FALL_DIST,
    CHECKPOINT_EVERY, RESPAWN_TICKS,
    hashStr, mulberry32, utcDay, dailyNumber, dailySeed,
    makeTrack, createState, step, simulate
  };
  global.OrbitSim = OrbitSim;
})(typeof globalThis !== "undefined" ? globalThis : this);
