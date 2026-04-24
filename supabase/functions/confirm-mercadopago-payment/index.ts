import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function mapPaymentStatus(status: string) {
  if (status === "approved") return "aprobado";
  if (status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back") return "rechazado";
  return "pendiente";
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

  const authHeader = request.headers.get("authorization") || "";
  const authToken = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(authToken);

  if (userError || !user) {
    return jsonResponse({ error: "Necesitas iniciar sesion." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const paymentId = String(body.paymentId || "").trim();

  if (!orderId || !paymentId) {
    return jsonResponse({ error: "Faltan datos del pago." }, 400);
  }

  const mercadoPagoResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payment = await mercadoPagoResponse.json();

  if (!mercadoPagoResponse.ok) {
    return jsonResponse({ error: payment?.message || "No pudimos consultar el pago.", details: payment }, 502);
  }

  const externalReference = String(payment.external_reference || "");

  if (externalReference !== orderId) {
    return jsonResponse({ error: "El pago no corresponde a este pedido." }, 403);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "No encontramos el pedido." }, 404);
  }

  if (order.user_id !== user.id) {
    return jsonResponse({ error: "No podes confirmar un pedido de otra cuenta." }, 403);
  }

  const nextPaymentStatus = mapPaymentStatus(String(payment.status || ""));

  const orderUpdate: Record<string, string> = {
    payment_status: nextPaymentStatus,
    updated_at: new Date().toISOString()
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

  return jsonResponse({
    orderId,
    paymentId,
    mercadoPagoStatus: payment.status,
    paymentStatus: nextPaymentStatus
  });
});
