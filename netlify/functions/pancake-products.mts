import type { Context } from "@netlify/functions";

const BASE_URL = "https://pos.pages.fm/api/v1";

async function apiFetch(path: string, apiKey: string): Promise<{ status: number; ok: boolean; body: any }> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}api_key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { status: res.status, ok: res.ok, body };
  } catch (err: any) {
    return { status: 0, ok: false, body: { error: err?.message ?? String(err) } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/pancake-products
 * Lists product variations from Pancake POS.
 * Use this to find the product_id and variation_id for each package,
 * then set them as env vars:
 *   PANCAKE_PRODUCT_ID_1PC, PANCAKE_VARIATION_ID_1PC
 *   PANCAKE_PRODUCT_ID_2PC, PANCAKE_VARIATION_ID_2PC
 *   PANCAKE_PRODUCT_ID_3PC, PANCAKE_VARIATION_ID_3PC
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    return json({ error: "PANCAKE_API_KEY or PANCAKE_SHOP_ID not set" }, 500);
  }

  // Fetch all product variations
  const result = await apiFetch(`/shops/${shopId}/products/variations`, apiKey);

  if (!result.ok) {
    return json({
      error: `API returned ${result.status}`,
      body: result.body,
      hint: result.status === 401 || result.status === 403
        ? "API key may be wrong. Go to Pancake POS → Settings → Application → API KEY to get the correct key."
        : "Unexpected error from Pancake API.",
    }, 200);
  }

  // Summarize: list each product + its variations with IDs
  const items: any[] = Array.isArray(result.body)
    ? result.body
    : result.body?.data ?? result.body?.variations ?? result.body?.products ?? [];

  const summary = items.map((v: any) => ({
    variation_id: v.id,
    product_id: v.product_id,
    name: v.name ?? v.fields?.map((f: any) => f.value).join(" / ") ?? "(no name)",
    custom_id: v.custom_id,
    retail_price: v.retail_price,
    barcode: v.barcode,
  }));

  // Also show current env var config
  const envConfig = {
    "1PC (starter_glow)": {
      PANCAKE_PRODUCT_ID_1PC: process.env.PANCAKE_PRODUCT_ID_1PC ?? "(not set)",
      PANCAKE_VARIATION_ID_1PC: process.env.PANCAKE_VARIATION_ID_1PC ?? "(not set)",
    },
    "2PC (bestie_pack)": {
      PANCAKE_PRODUCT_ID_2PC: process.env.PANCAKE_PRODUCT_ID_2PC ?? "(not set)",
      PANCAKE_VARIATION_ID_2PC: process.env.PANCAKE_VARIATION_ID_2PC ?? "(not set)",
    },
    "3PC (squad_pack)": {
      PANCAKE_PRODUCT_ID_3PC: process.env.PANCAKE_PRODUCT_ID_3PC ?? "(not set)",
      PANCAKE_VARIATION_ID_3PC: process.env.PANCAKE_VARIATION_ID_3PC ?? "(not set)",
    },
  };

  return json({ variations: summary, total: items.length, current_env_config: envConfig }, 200);
}

function json(data: any, status: number) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
