import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type OrderItem = {
  quantity: number;
  unit_price: number;
  products?: {
    name?: string | null;
  } | null;
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

function getOrigin(request: Request, bodyOrigin?: string) {
  const siteUrl = Deno.env.get("SITE_URL") || "";
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }

  const fromBody = String(bodyOrigin || "").trim();
  if (fromBody.startsWith("http://") || fromBody.startsWith("https://")) {
    return fromBody.replace(/\/$/, "");
  }

  const origin = request.headers.get("origin") || "";
  return origin.replace(/\/$/, "");
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
    return jsonResponse({ error: "Faltan variables de entorno para Mercado Pago o Supabase." }, 500);
  }

  const authHeader = request.headers.get("authorization") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

  if (userError || !user) {
    return jsonResponse({ error: "Necesitas iniciar sesion para pagar." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();

  if (!orderId) {
    return jsonResponse({ error: "Falta el pedido." }, 400);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, total, tax, payment_method, customer_phone, shipping_type, shipping_carrier")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "No encontramos el pedido." }, 404);
  }

  if (order.user_id !== user.id) {
    return jsonResponse({ error: "No podes pagar un pedido de otra cuenta." }, 403);
  }

  if (order.payment_method !== "mercadopago") {
    return jsonResponse({ error: "El pedido no esta configurado para Mercado Pago." }, 400);
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("quantity, unit_price, products(name)")
    .eq("order_id", orderId);

  if (itemsError || !orderItems?.length) {
    return jsonResponse({ error: "El pedido no tiene productos para cobrar." }, 400);
  }

  const origin = getOrigin(request, body.origin);

  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    return jsonResponse({ error: "Falta configurar SITE_URL para crear las URLs de retorno de Mercado Pago." }, 500);
  }

  const accountUrl = `${origin}/mi-cuenta.html`;
  const notificationUrl = Deno.env.get("MP_WEBHOOK_URL") || undefined;
  const isLocalReturnUrl = origin.includes("127.0.0.1") || origin.includes("localhost");
  const mercadoPagoItems = (orderItems as OrderItem[]).map((item, index) => ({
    id: `${orderId}-${index + 1}`,
    title: item.products?.name || `Producto ${index + 1}`,
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    currency_id: "ARS"
  }));
  const paymentSurcharge = Number(order.tax || 0);

  if (paymentSurcharge > 0) {
    mercadoPagoItems.push({
      id: `${orderId}-recargo`,
      title: "Recargo por pago con Mercado Pago",
      quantity: 1,
      unit_price: paymentSurcharge,
      currency_id: "ARS"
    });
  }

  const preferencePayload = {
    items: mercadoPagoItems,
    payer: {
      email: user.email,
      phone: order.customer_phone
        ? {
            number: order.customer_phone
          }
        : undefined
    },
    back_urls: {
      success: `${accountUrl}?payment=success&order=${orderId}`,
      failure: `${accountUrl}?payment=failure&order=${orderId}`,
      pending: `${accountUrl}?payment=pending&order=${orderId}`
    },
    auto_return: isLocalReturnUrl ? undefined : "approved",
    external_reference: orderId,
    notification_url: notificationUrl,
    metadata: {
      order_id: orderId,
      user_id: user.id
    }
  };

  const mercadoPagoResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preferencePayload)
  });

  const preference = await mercadoPagoResponse.json();

  if (!mercadoPagoResponse.ok) {
    return jsonResponse({
      error: preference?.message || "No pudimos crear la preferencia de Mercado Pago.",
      details: preference
    }, 502);
  }

  const checkoutUrl = accessToken.startsWith("TEST-")
    ? preference.sandbox_init_point || preference.init_point
    : preference.init_point || preference.sandbox_init_point;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      mercado_pago_preference_id: preference.id,
      mercado_pago_init_point: checkoutUrl,
      payment_status: "pendiente"
    })
    .eq("id", orderId);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({
    preferenceId: preference.id,
    checkoutUrl
  });
});
