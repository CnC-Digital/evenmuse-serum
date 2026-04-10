import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * Botcake Dynamic Block endpoint.
 *
 * In your Botcake flow, add a Dynamic Block and point it to:
 *   https://YOUR_SITE/api/botcake-order
 *
 * Botcake will POST subscriber data (including phone) to this URL.
 * We look up the pending order by phone and return the confirmation message.
 *
 * Dynamic Block response format:
 *   { "content": { "messages": [{ "type": "text", "text": "..." }] } }
 */
export default async function handler(req: Request, _context: Context) {
  // Support both GET (for testing) and POST (Botcake Dynamic Block)
  let phone = "";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      // Botcake sends Full Contact Data — phone is top-level
      phone = (body.phone ?? body.subscriber?.phone ?? "").toString();
    } catch {
      return errorResponse("Invalid request body");
    }
  } else if (req.method === "GET") {
    const url = new URL(req.url);
    phone = url.searchParams.get("phone") ?? "";
  } else {
    return errorResponse("Method not allowed", 405);
  }

  if (!phone) {
    return errorResponse("Missing phone");
  }

  const phoneKey = phone.replace(/\D/g, "");

  let order: Record<string, unknown> | null = null;
  try {
    const store = getStore("botcake-orders");
    order = await store.get(phoneKey, { type: "json" }) as Record<string, unknown> | null;
  } catch (err) {
    console.error("[botcake-order] Blob read error:", err);
  }

  if (!order) {
    // No pending order found — return a neutral fallback message
    return botcakeResponse(
      "Salamat sa iyong order! Ang aming team ay magpapadala ng kumpirmasyon sa iyo."
    );
  }

  const msg = [
    "Kindly double check your shipping details:",
    "",
    `Full Name: ${order.name}`,
    `Mobile Number: ${order.phone}`,
    `Address: ${order.address}`,
    order.landmark ? `Landmark: ${order.landmark}` : "",
    "",
    `Items: ${order.package}`,
    `Total amount: ₱${order.price}`,
    "",
    "This is our delivery timeframe:",
    "Metro Manila and Luzon: 3-7 Days",
    "Outside Luzon and Islands: 7-14 Days",
    "",
    "* THIS IS AN AUTOMATED MESSAGE *",
    "If you need assistance, don't hesitate to contact us.",
  ].filter((l) => l !== null).join("\n");

  return botcakeResponse(msg);
}

function botcakeResponse(text: string) {
  return new Response(
    JSON.stringify({
      content: {
        messages: [{ type: "text", text }],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
