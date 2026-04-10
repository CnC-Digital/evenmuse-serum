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

// Read individual product ID env vars instead of JSON
function getProductId(packageName: string): string {
  const map: Record<string, string | undefined> = {
    starter_glow: process.env.PANCAKE_PRODUCT_ID_STARTER_GLOW,
    bestie_pack:  process.env.PANCAKE_PRODUCT_ID_BESTIE_PACK,
    squad_pack:   process.env.PANCAKE_PRODUCT_ID_SQUAD_PACK,
  };
  return map[packageName] ?? "";
}

export async function createPancakeOrder(payload: PancakeOrderPayload): Promise<void> {
  const apiKey = process.env.PANCAKE_API_KEY;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !shopId) {
    console.warn("[pancake] Missing PANCAKE_API_KEY or PANCAKE_SHOP_ID — skipping order creation");
    return;
  }

  const productId = getProductId(payload.packageName);

  if (!productId) {
    console.warn(`[pancake] No product ID set for package: ${payload.packageName}`);
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
        product_id: productId,
        quantity: 1,
        price: payload.price,
      },
    ],
    payment_method: "COD",
    source: "landing_page",
  };

  // Pancake POS API URL — set PANCAKE_API_URL in env if you have a custom endpoint
  const apiUrl = process.env.PANCAKE_API_URL ?? "https://api-crm.pancake.ph/v2";

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
