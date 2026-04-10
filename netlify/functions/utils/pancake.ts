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

function getProductMap(): Record<string, string> {
  const raw = process.env.PANCAKE_PRODUCT_MAP ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[pancake] Invalid PANCAKE_PRODUCT_MAP JSON");
    return {};
  }
}

export async function createPancakeOrder(payload: PancakeOrderPayload): Promise<void> {
  const apiKey = process.env.PANCAKE_API_KEY;
  const apiUrl = process.env.PANCAKE_API_URL;
  const shopId = process.env.PANCAKE_SHOP_ID;

  if (!apiKey || !apiUrl || !shopId) {
    console.warn("[pancake] Missing Pancake env vars — skipping order creation");
    return;
  }

  const productMap = getProductMap();
  const productId = productMap[payload.packageName];

  if (!productId) {
    console.warn(`[pancake] No product ID mapped for package: ${payload.packageName}`);
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
        product_id: productId ?? "",
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
