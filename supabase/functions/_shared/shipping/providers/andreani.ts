import type {
  CreateShipmentResult,
  LabelResult,
  NormalizedShippingStatus,
  ShipmentOrder,
  ShippingProvider,
  TrackingResult
} from "../types.ts";

function env(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) {
    throw new Error(`Falta configurar ${name} en Supabase secrets.`);
  }
  return value;
}

function baseUrl() {
  return requiredEnv("ANDREANI_API_BASE_URL").replace(/\/$/, "");
}

function andreaniHeaders(extra: HeadersInit = {}) {
  return {
    Authorization: `Bearer ${requiredEnv("ANDREANI_TOKEN")}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message = typeof body === "object" && body && "message" in body
      ? String((body as { message?: unknown }).message)
      : `Andreani respondio ${response.status}`;
    throw new Error(message);
  }

  return body;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizeAndreaniStatus(value: unknown): NormalizedShippingStatus {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (status.includes("pendiente") || status.includes("creado") || status === "pending") return "pending";
  if (status.includes("prepar") || status === "preparing") return "preparing";
  if (status.includes("admit") || status.includes("despach") || status === "shipped") return "shipped";
  if (status.includes("distribucion") || status.includes("transito") || status.includes("camino")) return "in_transit";
  if (status.includes("entreg") || status === "delivered") return "delivered";
  return "pending";
}

function firstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return "";
}

function shipmentPayload(order: ShipmentOrder) {
  const data = order.shipping_data || {};
  const explicitPayload = data.andreaniOrderPayload || data.orderPayload || data.shipmentPayload;

  if (explicitPayload && typeof explicitPayload === "object") {
    return explicitPayload;
  }

  return {
    externalReference: order.id,
    declaredValue: Number(order.total || 0),
    receiver: data.recipient || data.destination || {},
    sender: data.sender || data.origin || {},
    packages: data.packages || data.parcels || [{
      weight: data.weight || data.weight_grams || 1000,
      height: data.height || 10,
      width: data.width || 20,
      length: data.length || 20
    }],
    items: (order.order_items || []).map((item) => ({
      sku: item.product_id || item.id,
      description: item.products?.name || "Producto",
      quantity: Number(item.quantity || 1),
      value: Number(item.unit_price || 0)
    }))
  };
}

export const andreaniProvider: ShippingProvider = {
  async createShipment(order: ShipmentOrder): Promise<CreateShipmentResult> {
    const raw = await fetch(`${baseUrl()}/shipments`, {
      method: "POST",
      headers: andreaniHeaders(),
      body: JSON.stringify(shipmentPayload(order))
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const trackingCode = firstString(payload, ["trackingCode", "tracking_code", "number", "numeroEnvio"]);

    return {
      provider: "andreani",
      trackingCode: trackingCode || null,
      shippingStatus: normalizeAndreaniStatus(firstString(payload, ["status", "state", "estado"])),
      labelUrl: firstString(payload, ["labelUrl", "label_url", "urlEtiqueta"]) || null,
      labelBase64: firstString(payload, ["labelBase64", "label_base64"]) || null,
      raw
    };
  },

  async getTracking(trackingCode: string): Promise<TrackingResult> {
    const raw = await fetch(`${baseUrl()}/shipments/${encodeURIComponent(trackingCode)}/tracking`, {
      headers: andreaniHeaders({ "Content-Type": "application/json" })
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const rawEvents = Array.isArray(payload.events)
      ? payload.events
      : Array.isArray(payload.movements)
        ? payload.movements
        : [];

    return {
      provider: "andreani",
      trackingCode,
      status: normalizeAndreaniStatus(firstString(payload, ["status", "state", "estado"])),
      description: firstString(payload, ["description", "descripcion", "detail"]) || null,
      events: rawEvents.map((event) => {
        const item = event && typeof event === "object" ? event as Record<string, unknown> : {};

        return {
          status: normalizeAndreaniStatus(firstString(item, ["status", "state", "estado"])),
          description: firstString(item, ["description", "descripcion", "detail"]) || null,
          location: firstString(item, ["location", "ubicacion", "branch", "sucursal"]) || null,
          timestamp: firstString(item, ["timestamp", "date", "fecha"]) || null,
          raw: event
        };
      }),
      raw
    };
  },

  async getLabel(trackingCode: string): Promise<LabelResult> {
    const raw = await fetch(`${baseUrl()}/shipments/${encodeURIComponent(trackingCode)}/label`, {
      headers: andreaniHeaders({ Accept: "application/json" })
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

    return {
      provider: "andreani",
      trackingCode,
      contentType: firstString(payload, ["contentType", "content_type"]) || "application/pdf",
      labelBase64: firstString(payload, ["labelBase64", "label_base64", "base64"]) || null,
      labelUrl: firstString(payload, ["labelUrl", "label_url", "url"]) || null,
      raw
    };
  }
};
