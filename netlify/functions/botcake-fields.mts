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

  let ref = "";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      ref = (body.ref ?? "").toString();
      phone = (body.phone ?? "").toString();
      console.log("[botcake-fields] POST body:", JSON.stringify(body));
    } catch {
      return jsonResponse({ package: "", price: "" });
    }
  } else if (req.method === "GET") {
    const url = new URL(req.url);
    ref = url.searchParams.get("ref") ?? "";
    phone = url.searchParams.get("phone") ?? "";
  } else {
    return jsonResponse({ package: "", price: "" });
  }

  // Extract UUID from ref format: "2539956--webcakeorderid___UUID"
  const uuidMatch = ref.match(/webcakeorderid___([a-f0-9-]{36})/i);
  const orderKey = uuidMatch ? `order_${uuidMatch[1]}` : phone.replace(/\D/g, "");
  console.log("[botcake-fields] ref:", ref, "| phone:", phone, "| orderKey:", orderKey);

  if (!orderKey) {
    return jsonResponse({ package: "", price: "" });
  }

  let order: Record<string, unknown> | null = null;
  try {
    const store = getStore("botcake-orders");
    order = await store.get(orderKey, { type: "json" }) as Record<string, unknown> | null;
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
