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
}

const BASE_URL = "https://pos.pages.fm/api/v1";

// Maps package name → env var suffix for variation IDs
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
  if (!envSuffix) {
    console.warn(`[pancake] Unknown package: ${payload.packageName}`);
    return;
  }

  const productId  = process.env[`PANCAKE_PRODUCT_ID_${envSuffix}`];
  const variationId = process.env[`PANCAKE_VARIATION_ID_${envSuffix}`];

  if (!productId || !variationId) {
    console.warn(
      `[pancake] Missing PANCAKE_PRODUCT_ID_${envSuffix} or PANCAKE_VARIATION_ID_${envSuffix} — skipping`
    );
    return;
  }

  const fullAddress = [payload.address, payload.barangay, payload.city, payload.province]
    .filter(Boolean)
    .join(", ");

  const body = {
    shop_id: Number(shopId),
    bill_full_name: `${payload.firstName} ${payload.lastName}`.trim(),
    bill_phone_number: payload.phone,
    shipping_address: {
      full_name: `${payload.firstName} ${payload.lastName}`.trim(),
      phone_number: payload.phone,
      address: fullAddress,
      full_address: fullAddress,
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
    note: payload.landmark ? `Landmark: ${payload.landmark}` : "",
    is_free_shipping: false,
    received_at_shop: false,
    shipping_fee: 0,
    total_discount: 0,
    cash: payload.price,
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
