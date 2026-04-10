import type { Context } from "@netlify/functions";

const CANDIDATES = [
  "https://api-crm.pancake.ph/v2",
  "https://api-crm.pancake.ph/v1",
  "https://api-crm.pancake.ph",
  "https://pos.pancake.ph/api/v2",
  "https://pos.pancake.ph/api/v1",
  "https://pos.pancake.ph/api",
  "https://api-crm.pancake.vn/v2",
  "https://api-crm.pancake.vn/v1",
  "https://api-crm.pancake.vn",
  "https://api.pancake.vn/v2",
  "https://api.pancake.vn/v1",
  "https://api.pancake.ph/v2",
  "https://api.pancake.ph/v1",
];

async function probe(url: string, headers: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
    return { status: res.status, ok: res.ok, body };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/pancake-products
 * Probes all known Pancake API URLs and returns what each one responds.
 * Look for entries where "ok": true — that's your working URL.
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    return json({ error: "PANCAKE_API_KEY or PANCAKE_SHOP_ID not set" }, 500);
  }

  const results: any[] = [];

  for (const base of CANDIDATES) {
    const url = `${base}/shops/${shopId}/products`;
    const result = await probe(url, { Authorization: `Bearer ${apiKey}` });
    results.push({ url, ...result });

    // If we got a working response, also try the products endpoint directly
    if (result.ok) {
      return json({ found: true, workingUrl: base, result }, 200);
    }

    // Also try query param style
    const urlQS = `${base}/products?shop_id=${shopId}`;
    const resultQS = await probe(urlQS, { Authorization: `Bearer ${apiKey}` });
    results.push({ url: urlQS, ...resultQS });

    if (resultQS.ok) {
      return json({ found: true, workingUrl: base, result: resultQS }, 200);
    }
  }

  return json({ found: false, message: "No working URL found. Share this output so we can debug.", results }, 200);
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
