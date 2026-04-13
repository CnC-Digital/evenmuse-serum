export interface PancakeOrderPayload {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  landmark?: string;
  packageName: string;
  price: number;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmId?: string;
  landingUrl?: string;
  abandoned?: boolean;
}

const BASE_URL = "https://pos.pages.fm/api/v1";

const PRODUCT_ID = "4bce7f68-c32a-4c66-b6dd-2bf931362d34";

// Fallback IDs confirmed from the Pancake POS API (can be overridden via env vars)
const VARIATION_DEFAULTS: Record<string, { productId: string; variationId: string }> = {
  starter_glow: { productId: PRODUCT_ID, variationId: "ad9fd83f-d3dc-468e-8336-1aff0a4ae6fe" }, // Set A (1bottle) ₱349
  bestie_pack:  { productId: PRODUCT_ID, variationId: "60931bf2-0a81-47ed-b6a8-48b52b63dd85" }, // Set B (2bottles) ₱549
  squad_pack:   { productId: PRODUCT_ID, variationId: "950906a4-6015-45fe-8a42-adfb08900b28" }, // Set C (3bottles) ₱699
};

// Env var suffixes (override defaults if set in Netlify)
const PACKAGE_VARIATION_ENV: Record<string, string> = {
  starter_glow: "1PC",
  bestie_pack:  "2PC",
  squad_pack:   "3PC",
};

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function apiUrl(path: string, apiKey: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE_URL}${path}${sep}api_key=${apiKey}`;
}

export async function createPancakeOrder(payload: PancakeOrderPayload): Promise<void> {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    console.warn("[pancake] Missing PANCAKE_API_KEY or PANCAKE_SHOP_ID — skipping");
    return;
  }

  const envSuffix = PACKAGE_VARIATION_ENV[payload.packageName];
  const defaults = VARIATION_DEFAULTS[payload.packageName];

  if (!defaults) {
    console.warn(`[pancake] Unknown package: ${payload.packageName}`);
    return;
  }

  const productId = (envSuffix && process.env[`PANCAKE_PRODUCT_ID_${envSuffix}`]) || defaults.productId;
  const variationId = (envSuffix && process.env[`PANCAKE_VARIATION_ID_${envSuffix}`]) || defaults.variationId;

  console.log(`[pancake] Using product=${productId} variation=${variationId} for ${payload.packageName}`);

  const fullAddress = [payload.address, payload.barangay, payload.city, payload.province]
    .filter(Boolean)
    .join(", ");

  const fullName = `${payload.firstName} ${payload.lastName}`.trim();

  const body = {
    shop_id: Number(shopId),
    bill_full_name: fullName,
    bill_phone_number: payload.phone,
    shipping_address: {
      full_name: fullName,
      phone_number: payload.phone,
      address: payload.address || "",
      full_address: fullAddress,
      province_id: payload.provinceId || null,
      district_id: payload.districtId || null,
      commune_id: payload.communeId || null,
    },
    items: [
      {
        product_id: productId,
        variation_id: variationId,
        quantity: 1,
        discount_each_product: 0,
        is_bonus_product: false,
        is_discount_percent: false,
        is_wholesale: false,
        one_time_product: false,
      },
    ],
    status: payload.abandoned ? "abandoned" : undefined,
    note: [
      payload.abandoned ? "⚠️ ABANDONED CART — Customer did not complete order" : null,
      payload.landmark ? `Landmark: ${payload.landmark}` : null,
    ].filter(Boolean).join("\n") || "",
    is_free_shipping: false,
    received_at_shop: false,
    shipping_fee: 0,
    total_discount: 0,
    cash: payload.price,
    p_utm_source: payload.utmSource || null,
    p_utm_medium: payload.utmMedium || null,
    p_utm_campaign: payload.utmCampaign || null,
    p_utm_term: payload.utmTerm || null,
    p_utm_content: payload.utmContent || null,
    p_utm_id: payload.utmId || null,
    link: payload.landingUrl || null,
  };

  const res = await fetchWithTimeout(apiUrl(`/shops/${shopId}/orders`, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[pancake] Order creation failed: ${res.status}`, text);
  } else {
    const data = await res.json();
    console.log("[pancake] Order created:", data?.id ?? data);
  }
}
