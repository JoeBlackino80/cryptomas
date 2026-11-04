/* ============================================================
 * Orbit Rush — Supabase Edge Function (hosted deployment)
 *
 * Same contract as PROTOTYPE/orbit-server.js, Deno-flavoured:
 * every submitted tap log is re-simulated with the shared
 * deterministic sim, and only the server-computed score enters
 * the leaderboard (Postgres, via security-definer RPCs).
 *
 *   GET  /                         the game itself
 *   GET  /api/orbit/daily          today's challenge info
 *   POST /api/orbit/run            submit a run (verified)
 *   GET  /api/orbit/leaderboard    top runs for a day
 * ============================================================ */
import "./sim.js";
import { HTML } from "./client.ts";

const Sim = (globalThis as unknown as { OrbitSim: any }).OrbitSim;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LIMITS = {
  MAX_TAPS: 2000,
  NAME_RE: /^[A-Za-z0-9_-]{1,16}$/,
  PID_RE: /^[a-f0-9]{8,32}$/,
  RATE_WINDOW_MS: 60_000,
  RATE_MAX: 30,
  MIDNIGHT_GRACE_S: 120,
};

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      authorization: `Bearer ${SB_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn} failed: ${r.status} ${await r.text()}`);
  return await r.json();
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

/* naive per-IP rate limit (per warm instance — fine for alpha) */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > LIMITS.RATE_MAX;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/orbit-rush/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (path === "/" || path === "") {
      return new Response(HTML, {
        headers: { "content-type": "text/html; charset=utf-8", ...CORS },
      });
    }

    if (path === "/api/orbit/daily") {
      const now = Date.now();
      const day = Sim.utcDay(now);
      const midnight = new Date(day + "T00:00:00Z").getTime() + 86400000;
      return json({
        day,
        number: Sim.dailyNumber(now),
        secondsLeft: Math.floor((midnight - now) / 1000),
      });
    }

    if (path === "/api/orbit/run" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
      if (rateLimited(ip)) return json({ error: "slow down" }, 429);

      const { pid, name, day, taps, claimed } = await req.json().catch(() => ({}));

      if (typeof pid !== "string" || !LIMITS.PID_RE.test(pid))
        return json({ error: "bad pid" }, 400);
      const cleanName =
        typeof name === "string" && LIMITS.NAME_RE.test(name) ? name : "guest";
      if (!Array.isArray(taps) || taps.length > LIMITS.MAX_TAPS)
        return json({ error: "bad taps" }, 400);
      for (let i = 0; i < taps.length; i++) {
        const t = taps[i];
        if (!Number.isInteger(t) || t < 0 || t >= Sim.MAX_TICKS || (i > 0 && t <= taps[i - 1]))
          return json({ error: "bad taps" }, 400);
      }

      const now = Date.now();
      const today = Sim.utcDay(now);
      const yesterday = Sim.utcDay(now - 86400000);
      const secsIntoToday = Math.floor((now - new Date(today + "T00:00:00Z").getTime()) / 1000);
      if (day !== today && !(day === yesterday && secsIntoToday < LIMITS.MIDNIGHT_GRACE_S))
        return json({ error: "day closed", day: today }, 400);

      // authoritative re-simulation
      const g = Sim.simulate(Sim.dailySeed(day), taps);
      const score = g.score;
      const mismatch = Number.isFinite(claimed) && claimed !== score;

      const r = await rpc("submit_orbit_run", {
        p_day: day, p_pid: pid, p_name: cleanName,
        p_score: score, p_hops: g.hops, p_sparks: g.sparksHit, p_ticks: g.tick,
      });
      return json({
        ok: true, day, score, mismatch,
        improved: r.improved, best: r.best, rank: r.rank,
        players: r.players, top: r.top,
      });
    }

    if (path === "/api/orbit/leaderboard") {
      const qday = url.searchParams.get("day");
      const day = qday && /^\d{4}-\d{2}-\d{2}$/.test(qday) ? qday : Sim.utcDay();
      const qpid = url.searchParams.get("pid");
      const pid = qpid && LIMITS.PID_RE.test(qpid) ? qpid : null;
      const r = await rpc("get_orbit_leaderboard", { p_day: day, p_pid: pid });
      return json({ day, players: r.players, top: r.top, rank: r.rank, best: r.best });
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "internal" }, 500);
  }
});
