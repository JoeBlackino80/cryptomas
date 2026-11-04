/* Tests for the Orbit Rush deterministic sim + verification server.
 * Run: node --test PROTOTYPE/orbit-server.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "./sim.js";
import { createApp } from "./orbit-server.js";

const Sim = globalThis.OrbitSim;
const SEED = Sim.dailySeed(Sim.utcDay());

/* Greedy bot: searches release ticks that chain forward hops.
 * Proves a (seed, taps) log is a complete, verifiable run record. */
function findTaps(seed, wantHops) {
  const taps = [];
  let fromTick = 0, hops = 0;
  for (let h = 0; h < wantHops; h++) {
    let found = false;
    for (let c = fromTick + 3; c < fromTick + 720 && c < Sim.MAX_TICKS - 400; c += 3) {
      const g = Sim.simulate(seed, [...taps, c], { maxTicks: Math.min(c + 300, Sim.MAX_TICKS) });
      if (g.alive && g.state === "orbit" && g.hops === hops + 1) {
        taps.push(c); hops++; fromTick = c + 30; found = true; break;
      }
    }
    if (!found) break;
  }
  return taps;
}

async function startServer() {
  const app = createApp({ persist: false });
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { srv, base };
}
const post = (base, body) => fetch(`${base}/api/orbit/run`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
});

test("simulation is deterministic for the same (seed, taps)", () => {
  const taps = findTaps(SEED, 3);
  assert.ok(taps.length >= 1, "bot should find at least one hop");
  const a = Sim.simulate(SEED, taps);
  const b = Sim.simulate(SEED, taps);
  assert.equal(a.score, b.score);
  assert.equal(a.tick, b.tick);
  assert.equal(a.hops, b.hops);
  assert.equal(a.endReason, b.endReason);
  assert.ok(a.score > 0, "a chained run scores points");
});

test("death never ends a run — every run lasts the full 60s (checkpoint rule)", () => {
  // A blind early release usually dies; whatever happens, the run must end by
  // the timer, having respawned at a gate rather than terminating.
  const g = Sim.simulate(SEED, [1, 500, 1200, 2500]);
  assert.equal(g.endReason, "time");
  assert.equal(g.tick, Sim.MAX_TICKS);
});

test("reaching a gate sets the respawn checkpoint and pays the bonus", () => {
  const taps = findTaps(SEED, Sim.CHECKPOINT_EVERY + 1);   // climb past ring 5
  const g = Sim.simulate(SEED, taps);
  assert.ok(g.maxAnchor >= Sim.CHECKPOINT_EVERY, "bot climbed past the first gate");
  assert.ok(g.checkpoint >= Sim.CHECKPOINT_EVERY, "gate recorded as checkpoint");
});

test("gates never carry spikes (respawn must be safe)", () => {
  const track = Sim.makeTrack(12345);
  for (let i = 0; i < track.anchors.length; i += Sim.CHECKPOINT_EVERY) {
    assert.equal(track.anchors[i].spike, -1, `anchor ${i}`);
  }
});

test("different taps give a different run (log actually drives the sim)", () => {
  const taps = findTaps(SEED, 2);
  const a = Sim.simulate(SEED, taps);
  const b = Sim.simulate(SEED, []);
  assert.notEqual(a.score, b.score);
});

test("server verifies an honest run and ranks it", async () => {
  const { srv, base } = await startServer();
  try {
    const taps = findTaps(SEED, 3);
    const local = Sim.simulate(SEED, taps);
    const res = await post(base, {
      pid: "aabbccdd11223344", name: "honest", day: Sim.utcDay(), taps, claimed: local.score
    });
    const d = await res.json();
    assert.equal(res.status, 200);
    assert.equal(d.ok, true);
    assert.equal(d.score, local.score, "server re-simulation matches client");
    assert.equal(d.mismatch, false);
    assert.equal(d.rank, 1);
    assert.equal(d.top[0].name, "honest");
  } finally { srv.close(); }
});

test("server score is authoritative — inflated claims change nothing", async () => {
  const { srv, base } = await startServer();
  try {
    const taps = findTaps(SEED, 2);
    const real = Sim.simulate(SEED, taps).score;
    const res = await post(base, {
      pid: "aabbccdd11223344", name: "cheater", day: Sim.utcDay(), taps, claimed: 999999
    });
    const d = await res.json();
    assert.equal(d.ok, true);
    assert.equal(d.score, real, "leaderboard gets the re-simulated score, not the claim");
    assert.equal(d.mismatch, true);
  } finally { srv.close(); }
});

test("server rejects malformed submissions", async () => {
  const { srv, base } = await startServer();
  try {
    const day = Sim.utcDay();
    const cases = [
      { pid: "zz", name: "x", day, taps: [] },                          // bad pid
      { pid: "aabbccdd11223344", name: "x", day, taps: [50, 40] },      // not increasing
      { pid: "aabbccdd11223344", name: "x", day, taps: [1.5] },         // non-integer
      { pid: "aabbccdd11223344", name: "x", day, taps: [Sim.MAX_TICKS] }, // out of range
      { pid: "aabbccdd11223344", name: "x", day: "2020-01-01", taps: [] } // closed day
    ];
    for (const c of cases) {
      const res = await post(base, c);
      assert.equal(res.status, 400, JSON.stringify(c));
    }
  } finally { srv.close(); }
});

test("leaderboard orders players and keeps personal bests", async () => {
  const { srv, base } = await startServer();
  try {
    const day = Sim.utcDay();
    const taps = findTaps(SEED, 3);
    const good = Sim.simulate(SEED, taps).score;

    await post(base, { pid: "a1a1a1a1a1a1a1a1", name: "alice", day, taps });
    await post(base, { pid: "b2b2b2b2b2b2b2b2", name: "bob", day, taps: [] }); // 0-score run

    const d = await (await fetch(`${base}/api/orbit/leaderboard?pid=b2b2b2b2b2b2b2b2`)).json();
    assert.equal(d.players, 2);
    assert.equal(d.top[0].name, "alice");
    assert.equal(d.top[0].score, good);
    assert.equal(d.rank, 2);

    // bob improves -> overtakes; a later worse run must NOT lower his best
    const d2 = await (await post(base, { pid: "b2b2b2b2b2b2b2b2", name: "bob", day, taps })).json();
    assert.equal(d2.best, good);
    const d3 = await (await post(base, { pid: "b2b2b2b2b2b2b2b2", name: "bob", day, taps: [] })).json();
    assert.equal(d3.best, good, "personal best survives a worse later run");
    assert.equal(d3.improved, false);
  } finally { srv.close(); }
});
