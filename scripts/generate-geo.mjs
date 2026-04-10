/**
 * Generates assets/data/geo.json — all PH provinces + their cities from Pancake API.
 * Barangays are excluded (too many; loaded on-demand).
 *
 * Usage:
 *   node scripts/generate-geo.mjs
 *
 * Requires PANCAKE_API_KEY in .env (auto-read via dotenv if present).
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

// Load .env manually (no dependency needed)
try {
  const env = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

const API_KEY = process.env.PANCAKE_API_KEY;
if (!API_KEY) { console.error("PANCAKE_API_KEY not set"); process.exit(1); }

const BASE = "https://pos.pages.fm/api/v1";

async function get(path) {
  const res = await fetch(`${BASE}${path}&api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  const raw = await res.json();
  return Array.isArray(raw) ? raw : (raw.data ?? []);
}

console.log("Fetching provinces…");
const rawProvinces = await get("/geo/provinces?country_code=63");
const provinces = rawProvinces
  .map(p => ({ id: p.id, name: p.name_en || p.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log(`  ${provinces.length} provinces — fetching cities in parallel…`);

const CONCURRENCY = 10;
const results = [];

for (let i = 0; i < provinces.length; i += CONCURRENCY) {
  const batch = provinces.slice(i, i + CONCURRENCY);
  const settled = await Promise.allSettled(
    batch.map(p => get(`/geo/districts?province_id=${p.id}`))
  );
  for (let j = 0; j < batch.length; j++) {
    const r = settled[j];
    if (r.status === "fulfilled") {
      const cities = r.value
        .map(c => ({ id: c.id, name: c.name_en || c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      results.push({ ...batch[j], cities });
    } else {
      console.warn(`  WARN: failed to load cities for ${batch[j].name}:`, r.reason?.message);
      results.push({ ...batch[j], cities: [] });
    }
  }
  process.stdout.write(`  ${Math.min(i + CONCURRENCY, provinces.length)}/${provinces.length}\r`);
}

console.log("\nWriting assets/data/geo.json…");
writeFileSync(
  resolve(root, "assets/data/geo.json"),
  JSON.stringify(results),
  "utf8"
);

const totalCities = results.reduce((s, p) => s + p.cities.length, 0);
console.log(`Done — ${results.length} provinces, ${totalCities} cities.`);
