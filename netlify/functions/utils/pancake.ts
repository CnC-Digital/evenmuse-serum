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

// How many bottles each package contains — used to match the right variation
const PACKAGE_QTY: Record<string, number> = {
  starter_glow: 1,
  bestie_pack:  2,
  squad_pack:   3,
};

// Common Pancake POS API base URLs to try (Philippines market)
const PANCAKE_API_CANDIDATES = [
  "https://api-crm.pancake.ph/v2",
  "https://api-crm.pancake.ph/v1",
  "https://pos.pancake.ph/api/v2",
  "https://pos.pancake.ph/api/v1",
];

// Resolve the working API base URL by trying /products on each candidate
export async function resolvePancakeApiUrl(apiKey: string, shopId: string): Promise<string | null> {
  const override = process.env.PANCAKE_API_URL;
  if (override) return override;

  for (const base of PANCAKE_API_CANDIDATES) {
    try {
      const res = await fetch(`${base}/shops/${shopId}/products`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok || res.status === 200) {
        console.log(`[pancake] Resolved API URL: ${base}`);
        return base;
      }
    } catch {
      // try next
    }
  }
  return null;
}

// Fetch all products for the shop and return raw data (for debug endpoint)
export async function fetchPancakeProducts(apiKey: string, shopId: string): Promise<any> {
  const apiUrl = await resolvePancakeApiUrl(apiKey, shopId);
  if (!apiUrl) throw new Error("Could not resolve Pancake API URL");

  const res = await fetch(`${apiUrl}/shops/${shopId}/products`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pancake products fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}

// Find product_id + variation_id by matching quantity (number of bottles)
async function resolveVariant(
  apiKey: string,
  shopId: string,
  packageName: string
): Promise<{ productId: string; variantId: string } | null> {
  const qty = PACKAGE_QTY[packageName];
  if (!qty) return null;

  // Allow manual overrides via env vars (optional, skips API call)
  const manualProductId = process.env.PANCAKE_PRODUCT_ID;
  const manualVariantId = process.env[`PANCAKE_VARIANT_ID_${qty}PC`];
  if (manualProductId && manualVariantId) {
    return { productId: manualProductId, variantId: manualVariantId };
  }

  try {
    const data = await fetchPancakeProducts(apiKey, shopId);
    const products: any[] = Array.isArray(data) ? data : (data.data ?? data.products ?? []);

    for (const product of products) {
      const variations: any[] = product.variations ?? product.variants ?? [];
      for (const variant of variations) {
        // Match by quantity field (common field names in POS systems)
        const variantQty =
          variant.quantity ?? variant.qty ?? variant.pieces ?? variant.count;

        if (Number(variantQty) === qty) {
          return {
            productId: String(product.id ?? product.product_id),
            variantId: String(variant.id ?? variant.variation_id ?? variant.variant_id),
          };
        }
      }
    }
  } catch (err) {
    console.error("[pancake] Failed to resolve variant from API:", err);
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
    console.warn(`[pancake] Could not resolve product/variant for package: ${payload.packageName}`);
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

  const orderBody = {
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
  };

  const res = await fetch(`${apiUrl}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(orderBody),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[pancake] Order creation failed:", res.status, body);
  } else {
    const body = await res.json();
    console.log("[pancake] Order created:", body);
  }
}
