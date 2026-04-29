import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function mapPaymentStatus(status: string) {
  if (status === "approved") return "aprobado";
  if (
    status === "rejected" || status === "cancelled" || status === "refunded" ||
    status === "charged_back"
  ) return "rechazado";
  return "pendiente";
}

function paymentIdFromPayload(url: URL, body: Record<string, unknown>) {
  const queryId = url.searchParams.get("id") ||
    url.searchParams.get("data.id");
  const data = body.data && typeof body.data === "object"
    ? body.data as Record<string, unknown>
    : null;

  return String(
    data?.id ||
      body.id ||
      queryId ||
      "",
  ).trim();
}

function notificationTypeFromPayload(url: URL, body: Record<string, unknown>) {
  return String(
    body.type ||
      body.topic ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      "",
  ).trim();
}

function signaturePart(signature: string, key: string) {
  return signature
    .split(",")
    .map((part) => part.trim().split("=", 2))
    .find(([partKey]) => partKey === key)?.[1]?.trim() || "";
}

function dataIdForSignature(url: URL, body: Record<string, unknown>) {
  const data = body.data && typeof body.data === "object"
    ? body.data as Record<string, unknown>
    : null;
  const value = url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    String(data?.id || body.id || "");

  return String(value || "").trim().toLowerCase();
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

async function verifyMercadoPagoSignature(
  request: Request,
  url: URL,
  body: Record<string, unknown>,
  secret: string,
) {
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  const ts = signaturePart(xSignature, "ts");
  const v1 = signaturePart(xSignature, "v1");
  const dataId = dataIdForSignature(url, body);

  if (!xSignature || !xRequestId || !ts || !v1 || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);

  return timingSafeEqual(expected, v1.toLowerCase());
}

async function runPostPaymentTasks(
  supabaseUrl: string,
  serviceRoleKey: string,
  orderId: string,
) {
  const internalSecret = Deno.env.get("SHIPPING_INTERNAL_SECRET") || "";

  if (!internalSecret) {
    return {
      invoice: null,
      invoiceError:
        "SHIPPING_INTERNAL_SECRET no esta configurado; comprobante automatico omitido.",
      shipment: null,
      shipmentError:
        "SHIPPING_INTERNAL_SECRET no esta configurado; envio automatico omitido.",
    };
  }

  let invoice: unknown = null;
  let invoiceError: string | null = null;
  let shipment: unknown = null;
  let shipmentError: string | null = null;

  try {
    const invoiceResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-order-invoice`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ orderId }),
      },
    );

    const invoiceBody = await invoiceResponse.json().catch(() => null);

    if (!invoiceResponse.ok) {
      invoiceError = invoiceBody?.error ||
        "No pudimos enviar el comprobante automaticamente.";
    } else {
      invoice = invoiceBody;
    }
  } catch (error) {
    invoiceError = error instanceof Error
      ? error.message
      : "No pudimos enviar el comprobante automaticamente.";
  }

  try {
    const shipmentResponse = await fetch(
      `${supabaseUrl}/functions/v1/create-shipment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ orderId }),
      },
    );

    const shipmentBody = await shipmentResponse.json().catch(() => null);

    if (!shipmentResponse.ok) {
      shipmentError = shipmentBody?.error ||
        "No pudimos crear el envio automaticamente.";
    } else {
      shipment = shipmentBody;
    }
  } catch (error) {
    shipmentError = error instanceof Error
      ? error.message
      : "No pudimos crear el envio automaticamente.";
  }

  return { invoice, invoiceError, shipment, shipmentError };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MP_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!accessToken || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Faltan variables de entorno." }, 500);
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (!await verifyMercadoPagoSignature(request, url, body, webhookSecret)) {
    return jsonResponse({ error: "Firma de Mercado Pago invalida." }, 401);
  }

  const notificationType = notificationTypeFromPayload(url, body);

  if (notificationType && notificationType !== "payment") {
    return jsonResponse({ skipped: true, reason: "Tipo de notificacion ignorado." });
  }

  const paymentId = paymentIdFromPayload(url, body);

  if (!paymentId) {
    return jsonResponse({ error: "Falta payment id." }, 400);
  }

  const mercadoPagoResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payment = await mercadoPagoResponse.json();

  if (!mercadoPagoResponse.ok) {
    return jsonResponse({
      error: payment?.message || "No pudimos consultar el pago.",
      details: payment,
    }, 502);
  }

  const orderId = String(payment.external_reference || "").trim();

  if (!orderId) {
    return jsonResponse({ skipped: true, reason: "Pago sin external_reference." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "No encontramos el pedido." }, 404);
  }

  const nextPaymentStatus = mapPaymentStatus(String(payment.status || ""));
  const wasAlreadyApproved = order.payment_status === "aprobado";
  const orderUpdate: Record<string, string> = {
    payment_status: nextPaymentStatus,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  const postPayment = nextPaymentStatus === "aprobado" && !wasAlreadyApproved
    ? await runPostPaymentTasks(supabaseUrl, serviceRoleKey, orderId)
    : {
      invoice: null,
      invoiceError: null,
      shipment: null,
      shipmentError: null,
    };

  return jsonResponse({
    orderId,
    paymentId,
    mercadoPagoStatus: payment.status,
    paymentStatus: nextPaymentStatus,
    ...postPayment,
  });
});
