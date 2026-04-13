const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const SURVEY_LABELS: Record<string, string> = {
  starter_glow: "BUY 1: ₱349 + FREE SHIPPING",
  bestie_pack: "BUY 1 TAKE 1: ₱549 + FREE SHIPPING",
  squad_pack: "BUY 2 TAKE 1: ₱699 + FREE SHIPPING",
};

const ITEM_LABELS: Record<string, string> = {
  starter_glow: "EvenMuse Serum (Starter Glow - 30mL)",
  bestie_pack: "EvenMuse Serum (Bestie Pack - Buy 1 Take 1)",
  squad_pack: "EvenMuse Serum (Squad Pack - Buy 2 Take 1)",
};

export interface TelegramOrderPayload {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  barangay?: string;
  city: string;
  province: string;
  landmark?: string;
  packageName: string;
  packageLabel: string;
  price: number;
  eventId: string;
  landingUrl?: string;
  clientIp?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmId?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface TelegramAbandonedPayload {
  firstName?: string;
  lastName?: string;
  phone: string;
  address?: string;
  barangay?: string;
  city?: string;
  province?: string;
  landmark?: string;
  packageName: string;
  price: number;
  landingUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export async function sendTelegramAbandonedNotification(order: TelegramAbandonedPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("[telegram] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars are required");
  }

  const fullName = [order.firstName, order.lastName].filter(Boolean).join(" ") || "Unknown";
  const fullAddress = [order.address, order.barangay, order.city, order.province]
    .filter(Boolean)
    .join(", ") || "Not provided";

  const surveyLabel = SURVEY_LABELS[order.packageName] ?? `₱${order.price}`;

  const utmLine = [
    order.utmSource   ? `utm_source=${order.utmSource}`     : null,
    order.utmMedium   ? `utm_medium=${order.utmMedium}`     : null,
    order.utmCampaign ? `utm_campaign=${order.utmCampaign}` : null,
  ].filter(Boolean).join(" | ");

  const text = [
    `🚨 ABANDONED CART`,
    ``,
    `Nagfill-up pero di nagorder.`,
    ``,
    `phone_number: ${order.phone}`,
    `full_name: ${fullName}`,
    `address: ${fullAddress}${order.landmark ? `, ${order.landmark}` : ""}`,
    `package: ${surveyLabel}`,
    ``,
    utmLine ? `UTM: ${utmLine}` : null,
    order.landingUrl ? `Link: ${order.landingUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[telegram] abandoned sendMessage failed: ${res.status} ${err}`);
  }
}

export async function sendTelegramOrderNotification(order: TelegramOrderPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error("[telegram] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars are required");
  }

  const fullName = `${order.firstName} ${order.lastName}`.trim();
  const fullAddress = [order.address, order.barangay, order.city, order.province]
    .filter(Boolean)
    .join(", ");

  const utmParams = [
    order.utmSource   ? `utm_source=${order.utmSource}`     : null,
    order.utmMedium   ? `utm_medium=${order.utmMedium}`     : null,
    order.utmCampaign ? `utm_campaign=${order.utmCampaign}` : null,
    order.utmId       ? `utm_id=${order.utmId}`             : null,
    order.utmContent  ? `utm_content=${order.utmContent}`   : null,
    order.utmTerm     ? `utm_term=${order.utmTerm}`         : null,
  ].filter(Boolean);

  const linkWithUtm =
    order.landingUrl && utmParams.length
      ? `${order.landingUrl}${order.landingUrl.includes("?") ? "&" : "?"}${utmParams.join("&")}`
      : order.landingUrl ?? "";

  const surveyLabel = SURVEY_LABELS[order.packageName] ?? order.packageLabel;
  const itemLabel   = ITEM_LABELS[order.packageName]   ?? order.packageLabel;

  const text = [
    `Page form data from Webcake`,
    ``,
    `phone_number: ${order.phone}`,
    `address: ${fullAddress}${order.landmark ? `, ${order.landmark}` : ""}`,
    `survey_1: ${surveyLabel}`,
    `full_name: ${fullName}`,
    `Items:`,
    ` ${itemLabel} - ${order.price} x 1`,
    `Total price: ₱ ${order.price.toLocaleString()}`,
    ``,
    linkWithUtm ? `Link: ${linkWithUtm}` : null,
    ``,
    order.clientIp ? `IP: ${order.clientIp}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[telegram] sendMessage failed: ${res.status} ${err}`);
  }
}
