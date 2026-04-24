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
  return requiredEnv("CORREO_API_BASE_URL").replace(/\/$/, "");
}

function correoHeaders(extra: HeadersInit = {}) {
  return {
    Authorization: `Apikey ${requiredEnv("CORREO_API_KEY")}`,
    agreement: requiredEnv("CORREO_AGREEMENT"),
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
      : `Correo Argentino respondio ${response.status}`;
    throw new Error(message);
  }

  return body;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizeCorreoStatus(value: unknown): NormalizedShippingStatus {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["preimposicion", "pre imposicion", "pendiente", "pending"].includes(status)) return "pending";
  if (["preparacion", "preparing", "preparando"].includes(status)) return "preparing";
  if (["impuesto", "admitido", "shipped", "despachado"].includes(status)) return "shipped";
  if (status.includes("distribucion") || status.includes("transito") || status.includes("camino")) return "in_transit";
  if (status.includes("entregado") || status === "delivered") return "delivered";
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
  const explicitPayload = data.correoOrderPayload || data.orderPayload || data.shipmentPayload;

  if (explicitPayload && typeof explicitPayload === "object") {
    return explicitPayload;
  }

  return {
    external_reference: order.id,
    service: data.service || "paq-ar",
    declared_value: Number(order.total || 0),
    recipient: data.recipient || {
      name: order.profiles?.full_name || data.recipient_name || "Cliente Glow Boxes",
      phone: order.customer_phone || data.recipient_phone || "",
      email: data.recipient_email || "",
      address: data.destination || data.recipient_address || {}
    },
    sender: data.sender || data.origin || {},
    parcels: data.parcels || [{
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

export const correoProvider: ShippingProvider = {
  async createShipment(order: ShipmentOrder): Promise<CreateShipmentResult> {
    const raw = await fetch(`${baseUrl()}/v1/orders`, {
      method: "POST",
      headers: correoHeaders(),
      body: JSON.stringify(shipmentPayload(order))
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const trackingCode = firstString(payload, [
      "tracking_code",
      "trackingCode",
      "tracking",
      "shipment_number",
      "numeroEnvio",
      "numero_envio"
    ]);
    const rawStatus = firstString(payload, ["status", "estado", "state"]);

    return {
      provider: "correo",
      trackingCode: trackingCode || null,
      shippingStatus: normalizeCorreoStatus(rawStatus),
      labelUrl: firstString(payload, ["label_url", "labelUrl", "etiqueta_url"]) || null,
      labelBase64: firstString(payload, ["label_base64", "labelBase64", "etiqueta"]) || null,
      raw
    };
  },

  async getTracking(trackingCode: string): Promise<TrackingResult> {
    const url = new URL(`${baseUrl()}/v1/tracking`);
    url.searchParams.set("tracking_code", trackingCode);

    const raw = await fetch(url, {
      headers: correoHeaders({ "Content-Type": "application/json" })
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const rawEvents = Array.isArray(payload.events)
      ? payload.events
      : Array.isArray(payload.movements)
        ? payload.movements
        : [];
    const status = normalizeCorreoStatus(firstString(payload, ["status", "estado", "state"]));

    return {
      provider: "correo",
      trackingCode,
      status,
      description: firstString(payload, ["description", "descripcion", "detail"]) || null,
      events: rawEvents.map((event) => {
        const item = event && typeof event === "object" ? event as Record<string, unknown> : {};
        const itemStatus = normalizeCorreoStatus(firstString(item, ["status", "estado", "state"]));

        return {
          status: itemStatus,
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
    const raw = await fetch(`${baseUrl()}/v1/labels`, {
      method: "POST",
      headers: correoHeaders(),
      body: JSON.stringify({ tracking_code: trackingCode })
    }).then(parseResponse);

    const payload = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

    return {
      provider: "correo",
      trackingCode,
      contentType: firstString(payload, ["content_type", "contentType"]) || "application/pdf",
      labelBase64: firstString(payload, ["label_base64", "labelBase64", "etiqueta", "base64"]) || null,
      labelUrl: firstString(payload, ["label_url", "labelUrl", "url"]) || null,
      raw
    };
  }
};
