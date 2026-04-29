import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Faltan variables de entorno." }, 500);
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
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
    .select("id, payment_status")
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

  if (nextPaymentStatus === "aprobado") {
    orderUpdate.status = "pedido_recibido";
  }

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
