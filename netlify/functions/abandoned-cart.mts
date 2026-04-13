import type { Context } from "@netlify/functions";
import { createPancakeOrder } from "./utils/pancake.js";
import { sendTelegramAbandonedNotification } from "./utils/telegram.js";

const PACKAGE_PRICES: Record<string, number> = {
  starter_glow: 349,
  bestie_pack: 549,
  squad_pack: 699,
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
    firstName = "",
    lastName = "",
    phone,
    address = "",
    barangay = "",
    city = "",
    province = "",
    landmark = "",
    packageName = "bestie_pack",
    provinceId = "",
    districtId = "",
    communeId = "",
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    utm_id,
    landing_url,
  } = body;

  if (!phone) {
    return new Response(JSON.stringify({ error: "Phone required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const price = PACKAGE_PRICES[packageName] ?? 549;
  const sourceUrl =
    req.headers.get("referer") ??
    `https://${req.headers.get("host") ?? "evenmuse.com"}/`;

  const results = await Promise.allSettled([
    createPancakeOrder({
      firstName: firstName || "Unknown",
      lastName: lastName || "Customer",
      phone,
      address: address || "Not provided",
      barangay,
      city: city || "Unknown",
      province: province || "Unknown",
      landmark,
      packageName,
      price,
      provinceId,
      districtId,
      communeId,
      utmSource: utm_source ?? "",
      utmMedium: utm_medium ?? "",
      utmCampaign: utm_campaign ?? "",
      utmTerm: utm_term ?? "",
      utmContent: utm_content ?? "",
      utmId: utm_id ?? "",
      landingUrl: landing_url ?? sourceUrl,
      abandoned: true,
    }),
    sendTelegramAbandonedNotification({
      firstName,
      lastName,
      phone,
      address,
      barangay,
      city,
      province,
      landmark,
      packageName,
      price,
      landingUrl: landing_url ?? sourceUrl,
      utmSource: utm_source ?? "",
      utmMedium: utm_medium ?? "",
      utmCampaign: utm_campaign ?? "",
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const names = ["pancake", "telegram"];
      console.error(`[abandoned-cart] ${names[i]} failed:`, result.reason);
    }
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
