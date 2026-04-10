import type { Context } from "@netlify/functions";

async function probe(url: string, headers: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 150); }
    return { status: res.status, ok: res.ok, body };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/pancake-products
 * Probes pos.pancake.ph with many path patterns to find the real API route.
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    return json({ error: "PANCAKE_API_KEY or PANCAKE_SHOP_ID not set" }, 500);
  }

  const base = "https://pos.pancake.ph";
  const auth = { Authorization: `Bearer ${apiKey}` };

  // Try many path patterns on pos.pancake.ph
  const paths = [
    `/v2/shops/${shopId}/products`,
    `/v1/shops/${shopId}/products`,
    `/v2/products?shop_id=${shopId}`,
    `/v1/products?shop_id=${shopId}`,
    `/shop/${shopId}/products`,
    `/shops/${shopId}/products`,
    `/products?shop_id=${shopId}`,
    `/v2/shop/${shopId}/product`,
    `/v1/shop/${shopId}/product`,
    `/v2/product?shop_id=${shopId}`,
    `/v1/product?shop_id=${shopId}`,
    `/product?shop_id=${shopId}`,
    // Pancake may use "page" instead of shop
    `/v2/page/${shopId}/products`,
    `/v1/page/${shopId}/products`,
    // With api key as query param instead of header
    `/v2/shops/${shopId}/products?api_key=${apiKey}`,
    `/v1/shops/${shopId}/products?api_key=${apiKey}`,
    `/v2/products?shop_id=${shopId}&api_key=${apiKey}`,
    `/v1/products?shop_id=${shopId}&api_key=${apiKey}`,
  ];

  const results: any[] = [];

  for (const path of paths) {
    const url = `${base}${path}`;
    const result = await probe(url, path.includes("api_key=") ? {} : auth);
    results.push({ url, ...result });

    if (result.ok) {
      return json({ found: true, workingUrl: url, data: result.body }, 200);
    }

    // 401/403 means the server understood us — auth is just wrong
    if (result.status === 401 || result.status === 403) {
      return json({
        found: false,
        hint: `Server responded at ${url} with ${result.status} — server exists, auth format may be wrong`,
        result,
      }, 200);
    }
  }

  return json({
    found: false,
    message: "No working path found on pos.pancake.ph. All returned 404.",
    results,
  }, 200);
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
