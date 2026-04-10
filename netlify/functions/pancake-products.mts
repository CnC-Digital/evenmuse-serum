import type { Context } from "@netlify/functions";
import { fetchPancakeProducts, resolvePancakeApiUrl } from "./utils/pancake.js";

/**
 * GET /api/pancake-products
 *
 * Debug endpoint — shows all products & variants from your Pancake POS shop.
 * Use this to confirm the API is working and see how products/variants are structured.
 *
 * Remove or protect this endpoint once you've confirmed everything is working.
 */
export default async function handler(req: Request, context: Context) {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    return new Response(
      JSON.stringify({ error: "PANCAKE_API_KEY or PANCAKE_SHOP_ID not set in environment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const apiUrl = await resolvePancakeApiUrl(apiKey, shopId);
    const products = await fetchPancakeProducts(apiKey, shopId);

    return new Response(
      JSON.stringify({ resolvedApiUrl: apiUrl, products }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
