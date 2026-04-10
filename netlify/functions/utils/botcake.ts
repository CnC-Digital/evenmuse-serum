export interface BotcakePayload {
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
  eventId: string;
}

export async function sendBotcakeWebhook(payload: BotcakePayload): Promise<void> {
  const webhookUrl = process.env.BOTCAKE_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[botcake] BOTCAKE_WEBHOOK_URL not set — skipping webhook");
    return;
  }

  const body = {
    event: "new_order",
    event_id: payload.eventId,
    customer: {
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      phone: payload.phone,
    },
    order: {
      package: payload.packageName,
      price: payload.price,
      address: [
        payload.address,
        payload.barangay,
        payload.city,
        payload.province,
      ]
        .filter(Boolean)
        .join(", "),
      landmark: payload.landmark ?? "",
    },
    source: "evenmuse_serum_lander",
    timestamp: new Date().toISOString(),
  };

  // Fire-and-forget with 5s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[botcake] Webhook failed:", res.status, text);
    } else {
      console.log("[botcake] Webhook sent successfully");
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("[botcake] Webhook timed out after 5s");
    } else {
      console.error("[botcake] Webhook error:", err);
    }
  } finally {
    clearTimeout(timeout);
  }
}
