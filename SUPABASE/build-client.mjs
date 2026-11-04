/* Builds the deployable Orbit Rush bundles from the PROTOTYPE sources
 * (single source of truth):
 *
 *   node SUPABASE/build-client.mjs
 *
 * - DEPLOY/              static game bundle for Vercel (the page cannot be
 *   served from Supabase: its gateway rewrites text/html to text/plain on
 *   *.supabase.co as an anti-phishing measure)
 * - SUPABASE/functions/orbit-rush/sim.js   copy for the API edge function
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = "https://nkxnkcsvtqbbczhnpokt.supabase.co/functions/v1/orbit-rush";
const TAG = '<script src="sim.js"></script>';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sim = fs.readFileSync(path.join(root, "PROTOTYPE", "sim.js"), "utf8");
const html = fs.readFileSync(path.join(root, "PROTOTYPE", "orbit-rush.html"), "utf8");
if (!html.includes(TAG)) throw new Error("sim.js script tag not found");

// API edge function: needs only the sim for run verification.
const fnDir = path.join(root, "SUPABASE", "functions", "orbit-rush");
fs.mkdirSync(fnDir, { recursive: true });
fs.writeFileSync(path.join(fnDir, "sim.js"),
  "// GENERATED copy of PROTOTYPE/sim.js (see build-client.mjs).\n" + sim);
console.log("built", fnDir);

// Static-hosting bundle (Vercel): same client, API pointed at Supabase.
const deployDir = path.join(root, "DEPLOY");
fs.mkdirSync(deployDir, { recursive: true });
fs.writeFileSync(path.join(deployDir, "index.html"), html.replace(TAG,
  `<script>window.ORBIT_API = ${JSON.stringify(API_BASE)};</script>\n${TAG}`));
fs.writeFileSync(path.join(deployDir, "sim.js"), sim);
console.log("built", deployDir);
