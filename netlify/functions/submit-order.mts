import type { Context } from "@netlify/functions";
import { randomUUID } from "crypto";
import { sendCAPIEvent } from "./utils/meta-capi.js";
import { createPancakeOrder } from "./utils/pancake.js";
import { sendBotcakeWebhook } from "./utils/botcake.js";

const PACKAGE_PRICES: Record<string, number> = {
  starter_glow: 349,
  bestie_pack: 549,
  squad_pack: 699,
};

const PACKAGE_LABELS: Record<string, string> = {
  starter_glow: "Starter Glow — Buy 1 (30mL)",
  bestie_pack: "Bestie Pack — Buy 1 Take 1",
  squad_pack: "Squad Pack — Buy 2 Take 1",
};

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    firstName,
    lastName,
    phone,
    address,
    barangay,
    city,
    province,
    landmark,
    packageName,
  } = body;

  // Basic validation
  if (!firstName || !lastName || !phone || !address || !city || !province || !packageName) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const price = PACKAGE_PRICES[packageName];
  if (!price) {
    return new Response(JSON.stringify({ error: "Invalid package" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventId = randomUUID();
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("client-ip") ??
    undefined;
  const clientUserAgent = req.headers.get("user-agent") ?? undefined;
  const sourceUrl =
    req.headers.get("referer") ??
    `https://${req.headers.get("host") ?? "evenmuse.com"}/`;

  const orderPayload = {
    firstName,
    lastName,
    phone,
    address,
    barangay: barangay ?? "",
    city,
    province,
    landmark: landmark ?? "",
    packageName,
    price,
  };

  // Run all integrations in parallel — don't let one failure block the rest
  const results = await Promise.allSettled([
    createPancakeOrder(orderPayload),
    sendCAPIEvent({
      eventName: "Purchase",
      eventId,
      sourceUrl,
      phone,
      firstName,
      lastName,
      value: price,
      currency: "PHP",
      packageName: PACKAGE_LABELS[packageName],
      clientIp,
      clientUserAgent,
    }),
    sendBotcakeWebhook({ ...orderPayload, eventId }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const names = ["pancake", "meta-capi", "botcake"];
      console.error(`[submit-order] ${names[i]} failed:`, result.reason);
    }
  });

  return new Response(
    JSON.stringify({
      success: true,
      eventId,
      redirect: `/thankyou.html?eid=${eventId}&pkg=${encodeURIComponent(packageName)}`,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
