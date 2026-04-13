import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createPancakeOrder } from "./utils/pancake.js";
import { sendTelegramAbandonedNotification } from "./utils/telegram.js";

const ABANDONED_DELAY = 10 * 60 * 1000; // 10 minutes

const PACKAGE_PRICES: Record<string, number> = {
  starter_glow: 349,
  bestie_pack: 549,
  squad_pack: 699,
};

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response("", { status: 405 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response("", { status: 400 });
  }

  const { phone } = body;
  if (!phone) return new Response("", { status: 400 });

  const store = getStore("abandoned-carts");
  const cartKey = phone.replace(/\D/g, "");

  // Save cart as pending — if order is placed before we wake up,
  // submit-order will overwrite status to "completed"
  await store.setJSON(cartKey, { ...body, status: "pending", startedAt: Date.now() });

  // Sleep 10 minutes on the server — survives browser close/background
  await new Promise((r) => setTimeout(r, ABANDONED_DELAY));

  // Check if order was placed while we were sleeping
  const cart = (await store.get(cartKey, { type: "json" })) as Record<string, string> | null;
  if (!cart || cart.status !== "pending") return new Response("", { status: 200 });

  // Mark as notified before firing to prevent double-send
  await store.setJSON(cartKey, { ...cart, status: "notified" });

  const price = PACKAGE_PRICES[cart.packageName] ?? 549;
  const sourceUrl = `https://${new URL(cart.landing_url ?? "https://evenmuse.com").host}/`;

  const results = await Promise.allSettled([
    createPancakeOrder({
      firstName: cart.firstName || "Unknown",
      lastName: cart.lastName || "Customer",
      phone: cart.phone,
      address: cart.address || "Not provided",
      barangay: cart.barangay ?? "",
      city: cart.city || "Unknown",
      province: cart.province || "Unknown",
      landmark: cart.landmark ?? "",
      packageName: cart.packageName || "bestie_pack",
      price,
      provinceId: cart.provinceId ?? "",
      districtId: cart.districtId ?? "",
      communeId: cart.communeId ?? "",
      utmSource: cart.utm_source ?? "",
      utmMedium: cart.utm_medium ?? "",
      utmCampaign: cart.utm_campaign ?? "",
      utmTerm: cart.utm_term ?? "",
      utmContent: cart.utm_content ?? "",
      utmId: cart.utm_id ?? "",
      landingUrl: cart.landing_url ?? sourceUrl,
      abandoned: true,
    }),
    sendTelegramAbandonedNotification({
      firstName: cart.firstName ?? "",
      lastName: cart.lastName ?? "",
      phone: cart.phone,
      address: cart.address ?? "",
      barangay: cart.barangay ?? "",
      city: cart.city ?? "",
      province: cart.province ?? "",
      landmark: cart.landmark ?? "",
      packageName: cart.packageName ?? "bestie_pack",
      price,
      landingUrl: cart.landing_url ?? sourceUrl,
      utmSource: cart.utm_source ?? "",
      utmMedium: cart.utm_medium ?? "",
      utmCampaign: cart.utm_campaign ?? "",
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const names = ["pancake", "telegram"];
      console.error(`[cart-started-background] ${names[i]} failed:`, result.reason);
    }
  });

  return new Response("", { status: 200 });
}
