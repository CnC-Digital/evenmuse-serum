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

// How many bottles each package contains
const PACKAGE_QTY: Record<string, number> = {
  starter_glow: 1,
  bestie_pack:  2,
  squad_pack:   3,
};

// Fetch with a timeout so we don't hang on bad URLs
async function fetchWithTimeout(url: string, options: RequestInit, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Probe all known Pancake API base URLs and return the first one that responds
async function resolvePancakeApiUrl(apiKey: string, shopId: string): Promise<string | null> {
  // Manual override wins
  if (process.env.PANCAKE_API_URL) return process.env.PANCAKE_API_URL;

  const candidates = [
    // Philippines domain variants
    `https://api-crm.pancake.ph/v2`,
    `https://api-crm.pancake.ph/v1`,
    `https://api-crm.pancake.ph`,
    `https://pos.pancake.ph/api/v2`,
    `https://pos.pancake.ph/api/v1`,
    `https://pos.pancake.ph/api`,
    // Vietnam domain (Pancake is originally Vietnamese)
    `https://api-crm.pancake.vn/v2`,
    `https://api-crm.pancake.vn/v1`,
    `https://api-crm.pancake.vn`,
    `https://pos.pancake.vn/api/v2`,
    `https://pos.pancake.vn/api/v1`,
    // Other common patterns
    `https://api.pancake.vn/v2`,
    `https://api.pancake.vn/v1`,
    `https://api.pancake.ph/v2`,
    `https://api.pancake.ph/v1`,
  ];

  // Endpoint patterns to try per base URL
  const endpoints = (base: string) => [
    `${base}/shops/${shopId}/products`,
    `${base}/products?shop_id=${shopId}`,
    `${base}/product/list?shop_id=${shopId}`,
  ];

  // Auth patterns to try
  const authHeaders = [
    { Authorization: `Bearer ${apiKey}` },
    { Authorization: `Token ${apiKey}` },
    { "X-Api-Key": apiKey },
    { "api-key": apiKey },
  ];

  for (const base of candidates) {
    for (const url of endpoints(base)) {
      for (const headers of authHeaders) {
        try {
          const res = await fetchWithTimeout(url, { headers }, 4000);
          // Any real HTTP response (even 401/403) means the server exists
          if (res.status !== 0) {
            const text = await res.text();
            console.log(`[pancake] ${url} → ${res.status} (auth: ${JSON.stringify(headers)})`);
            if (res.ok) return base;
          }
        } catch {
          // timeout or DNS failure — try next
        }
      }
    }
  }

  return null;
}

// Fetch all products and find the right product_id + variation_id by bottle count
export async function resolveVariant(
  apiKey: string,
  shopId: string,
  packageName: string
): Promise<{ productId: string; variantId: string } | null> {
  const qty = PACKAGE_QTY[packageName];
  if (!qty) return null;

  const apiUrl = await resolvePancakeApiUrl(apiKey, shopId);
  if (!apiUrl) return null;

  const endpoints = [
    `${apiUrl}/shops/${shopId}/products`,
    `${apiUrl}/products?shop_id=${shopId}`,
  ];

  const authHeaders = [
    { Authorization: `Bearer ${apiKey}` },
    { Authorization: `Token ${apiKey}` },
    { "X-Api-Key": apiKey },
  ];

  for (const url of endpoints) {
    for (const headers of authHeaders) {
      try {
        const res = await fetchWithTimeout(url, { headers });
        if (!res.ok) continue;

        const data = await res.json();
        const products: any[] = Array.isArray(data) ? data : (data.data ?? data.products ?? []);

        for (const product of products) {
          const variations: any[] = product.variations ?? product.variants ?? [];
          for (const variant of variations) {
            const variantQty = variant.quantity ?? variant.qty ?? variant.pieces ?? variant.count;
            if (Number(variantQty) === qty) {
              return {
                productId: String(product.id ?? product.product_id),
                variantId: String(variant.id ?? variant.variation_id ?? variant.variant_id),
              };
            }
          }
        }
      } catch {
        // try next
      }
    }
  }

  return null;
}

export async function createPancakeOrder(payload: PancakeOrderPayload): Promise<void> {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    console.warn("[pancake] Missing PANCAKE_API_KEY or PANCAKE_SHOP_ID — skipping");
    return;
  }

  const apiUrl = await resolvePancakeApiUrl(apiKey, shopId);
  if (!apiUrl) {
    console.error("[pancake] Could not resolve API URL — skipping order creation");
    return;
  }

  const variant = await resolveVariant(apiKey, shopId, payload.packageName);
  if (!variant) {
    console.warn(`[pancake] Could not resolve variant for: ${payload.packageName}`);
    return;
  }

  const fullAddress = [
    payload.address,
    payload.barangay,
    payload.city,
    payload.province,
    "Philippines",
  ]
    .filter(Boolean)
    .join(", ");

  const res = await fetchWithTimeout(`${apiUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      shop_id: shopId,
      customer: {
        name: `${payload.firstName} ${payload.lastName}`.trim(),
        phone: payload.phone,
        address: fullAddress,
        note: payload.landmark ? `Landmark: ${payload.landmark}` : undefined,
      },
      items: [
        {
          product_id: variant.productId,
          variation_id: variant.variantId,
          quantity: 1,
          price: payload.price,
        },
      ],
      payment_method: "COD",
      source: "landing_page",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[pancake] Order creation failed:", res.status, body);
  } else {
    const body = await res.json();
    console.log("[pancake] Order created:", body);
  }
}
