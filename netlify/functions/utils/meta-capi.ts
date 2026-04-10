import { createHash } from "crypto";

const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  // Strip all non-digits, ensure E.164-ish format for PH numbers
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "63" + digits.slice(1);
  if (digits.startsWith("63")) return digits;
  return "63" + digits;
}

export interface CAPIEventData {
  eventName: string;
  eventId: string;
  sourceUrl: string;
  phone: string;
  firstName: string;
  lastName: string;
  value: number;
  currency?: string;
  packageName?: string;
  clientIp?: string;
  clientUserAgent?: string;
}

export async function sendCAPIEvent(data: CAPIEventData): Promise<void> {
  const pixelId = process.env.FB_PIXEL_ID;
  const accessToken = process.env.FB_ACCESS_TOKEN;
  const testEventCode = process.env.FB_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    console.warn("[meta-capi] Missing FB_PIXEL_ID or FB_ACCESS_TOKEN — skipping CAPI");
    return;
  }

  const normalizedPhone = normalizePhone(data.phone);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: data.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: data.eventId,
        event_source_url: data.sourceUrl,
        action_source: "website",
        user_data: {
          ph: [sha256(normalizedPhone)],
          fn: [sha256(data.firstName)],
          ln: [sha256(data.lastName)],
          ...(data.clientIp ? { client_ip_address: data.clientIp } : {}),
          ...(data.clientUserAgent ? { client_user_agent: data.clientUserAgent } : {}),
        },
        custom_data: {
          value: data.value,
          currency: data.currency ?? "PHP",
          content_name: data.packageName ?? "EvenMuse Alpha Arbutin Serum",
          content_category: "Skincare",
        },
      },
    ],
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const url = `${GRAPH_API_URL}/${pixelId}/events?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[meta-capi] CAPI request failed:", res.status, body);
  } else {
    const body = await res.json();
    console.log("[meta-capi] CAPI event sent:", data.eventName, body);
  }
}
