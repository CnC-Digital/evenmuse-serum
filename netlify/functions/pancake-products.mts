import type { Context } from "@netlify/functions";

/**
 * GET /api/pancake-products
 *
 * Debug endpoint — probes every known Pancake API URL + auth pattern
 * and returns the full response from each attempt so we can find the right one.
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    return json({ error: "PANCAKE_API_KEY or PANCAKE_SHOP_ID not set" }, 500);
  }

  // All URL + endpoint patterns to try
  const bases = [
    "https://api-crm.pancake.ph/v2",
    "https://api-crm.pancake.ph/v1",
    "https://api-crm.pancake.ph",
    "https://pos.pancake.ph/api/v2",
    "https://pos.pancake.ph/api/v1",
    "https://pos.pancake.ph/api",
  ];

  const endpointPatterns = (base: string) => [
    `${base}/shops/${shopId}/products`,
    `${base}/products?shop_id=${shopId}`,
    `${base}/product?shop_id=${shopId}`,
  ];

  // Auth header patterns to try
  const authHeaders = (key: string) => [
    { Authorization: `Bearer ${key}` },
    { Authorization: `Token ${key}` },
    { "X-Api-Key": key },
    { "api-key": key },
  ];

  const results: any[] = [];

  for (const base of bases) {
    for (const url of endpointPatterns(base)) {
      for (const headers of authHeaders(apiKey)) {
        try {
          const res = await fetch(url, { headers });
          const text = await res.text();
          let body: any;
          try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }

          results.push({
            url,
            auth: Object.keys(headers)[0],
            status: res.status,
            ok: res.ok,
            body,
          });

          // Stop probing if we get a real success
          if (res.ok) {
            return json({ found: true, working: { url, auth: Object.keys(headers)[0] }, body, allAttempts: results }, 200);
          }
        } catch (err) {
          results.push({ url, auth: Object.keys(headers)[0], error: String(err) });
        }
      }
    }
  }

  return json({ found: false, allAttempts: results }, 200);
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
