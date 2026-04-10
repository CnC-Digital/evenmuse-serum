import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Botcake JSON API Block endpoint.
 *
 * Botcake POSTs { "phone": "{{phone}}" } to this URL.
 * We look up the pending order by phone and return individual fields
 * that Botcake maps to subscriber custom fields (items, total_price).
 */
export default async function handler(req: Request, _context: Context) {
  let phone = "";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      phone = (body.phone ?? "").toString();
    } catch {
      return jsonResponse({ package: "", price: "" });
    }
  } else if (req.method === "GET") {
    const url = new URL(req.url);
    phone = url.searchParams.get("phone") ?? "";
  } else {
    return jsonResponse({ package: "", price: "" });
  }

  if (!phone) {
    return jsonResponse({ package: "", price: "" });
  }

  const phoneKey = phone.replace(/\D/g, "");

  let order: Record<string, unknown> | null = null;
  try {
    const store = getStore("botcake-orders");
    order = await store.get(phoneKey, { type: "json" }) as Record<string, unknown> | null;
  } catch (err) {
    console.error("[botcake-fields] Blob read error:", err);
  }

  if (!order) {
    return jsonResponse({ package: "EvenMuse Alpha Arbutin Serum", price: "" });
  }

  return jsonResponse({
    package: order.package as string ?? "",
    price: String(order.price ?? ""),
  });
}

function jsonResponse(data: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
