import type { Context } from "@netlify/functions";
import { randomUUID } from "crypto";
import { getStore } from "@netlify/blobs";
import { sendCAPIEvent } from "./utils/meta-capi.js";
import { createPancakeOrder } from "./utils/pancake.js";

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
    provinceId,
    districtId,
    communeId,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    utm_id,
    landing_url,
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
    provinceId: provinceId ?? "",
    districtId: districtId ?? "",
    communeId: communeId ?? "",
    utmSource: utm_source ?? "",
    utmMedium: utm_medium ?? "",
    utmCampaign: utm_campaign ?? "",
    utmTerm: utm_term ?? "",
    utmContent: utm_content ?? "",
    utmId: utm_id ?? "",
    landingUrl: landing_url ?? sourceUrl,
  };

  // Store order in Netlify Blobs for Botcake Dynamic Block lookup (keyed by normalized phone, TTL 2h)
  try {
    const store = getStore("botcake-orders");
    const phoneKey = phone.replace(/\D/g, "");
    const orderData = {
      name: `${firstName} ${lastName}`.trim(),
      phone,
      address: [orderPayload.address, orderPayload.barangay, orderPayload.city, orderPayload.province]
        .filter(Boolean).join(", "),
      landmark: orderPayload.landmark || "",
      package: PACKAGE_LABELS[packageName],
      price,
      eventId,
    };
    // Store by phone (fallback) and by eventId (ref URL approach)
    await store.setJSON(phoneKey, orderData, { ttl: 7200 });
    await store.setJSON(`order_${eventId}`, orderData, { ttl: 7200 });
  } catch (err) {
    console.warn("[botcake-blob] Failed to store order:", err);
  }

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
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const names = ["pancake", "meta-capi"];
      console.error(`[submit-order] ${names[i]} failed:`, result.reason);
    }
  });

  const messengerPageId = process.env.MESSENGER_PAGE_ID ?? "1049930684865708";
  const botcakeFlowRefId = process.env.BOTCAKE_FLOW_REF_ID ?? "2539956";
  const botcakeUrl = `https://m.me/${messengerPageId}?ref=${botcakeFlowRefId}--webcakeorderid___${eventId}`;

  return new Response(
    JSON.stringify({
      success: true,
      eventId,
      botcakeUrl,
      redirect: `/thankyou.html?eid=${eventId}&pkg=${encodeURIComponent(packageName)}&name=${encodeURIComponent(`${firstName} ${lastName}`.trim())}&price=${price}&phone=${encodeURIComponent(phone)}&addr=${encodeURIComponent([address, barangay, city, province].filter(Boolean).join(', '))}`,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
