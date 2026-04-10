import type { Context } from "@netlify/functions";

const BASE = "https://pos.pages.fm/api/v1";
const PH = "63";

async function pancakeFetch(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}&api_key=${apiKey}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Pancake geo ${path} → ${res.status}`);
  return res.json();
}

/**
 * GET /api/pancake-geo?type=provinces
 * GET /api/pancake-geo?type=districts&province_id=63_219
 * GET /api/pancake-geo?type=communes&district_id=63_2191264
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  if (!apiKey) return json({ error: "PANCAKE_API_KEY not set" }, 500);

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  try {
    if (type === "provinces") {
      const raw = await pancakeFetch(`/geo/provinces?country_code=${PH}`, apiKey);
      const items: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      const result = items
        .map((p: any) => ({ id: p.id, name: p.name_en || p.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      return json(result, 200);
    }

    if (type === "districts") {
      const provinceId = url.searchParams.get("province_id");
      if (!provinceId) return json({ error: "province_id required" }, 400);
      const raw = await pancakeFetch(`/geo/districts?province_id=${provinceId}`, apiKey);
      const items: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      const result = items
        .map((d: any) => ({ id: d.id, name: d.name_en || d.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      return json(result, 200);
    }

    if (type === "communes") {
      const districtId = url.searchParams.get("district_id");
      if (!districtId) return json({ error: "district_id required" }, 400);
      const raw = await pancakeFetch(`/geo/communes?district_id=${districtId}`, apiKey);
      const items: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      const result = items
        .map((c: any) => ({ id: c.id, name: c.name_en || c.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      return json(result, 200);
    }

    return json({ error: "type must be provinces, districts, or communes" }, 400);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
