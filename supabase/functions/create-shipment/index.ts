import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  getShippingProviderForOrder,
  providerForOrder,
  type ShipmentOrder,
} from "../_shared/shipping/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

type Database = {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: Record<string, {
      Args: Record<string, unknown>;
      Returns: unknown;
    }>;
  };
};

type SupabaseClient = ReturnType<typeof createClient<Database>>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function mergeShippingData(current: unknown, patch: Record<string, unknown>) {
  const base = current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};

  return {
    ...base,
    ...patch,
  };
}

async function assertAdminOrInternal(
  request: Request,
  supabase: SupabaseClient,
) {
  const internalSecret = Deno.env.get("SHIPPING_INTERNAL_SECRET") || "";
  const requestSecret = request.headers.get("x-internal-secret") || "";

  if (internalSecret && requestSecret && internalSecret === requestSecret) {
    return { ok: true, status: 200, error: null };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return { ok: false, status: 401, error: "Necesitas iniciar sesion." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { ok: false, status: 401, error: "Sesion invalida." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Solo administradores pueden crear envios.",
    };
  }

  return { ok: true, status: 200, error: null };
}

async function loadOrder(supabase: SupabaseClient, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      user_id,
      subtotal,
      discount,
      tax,
      total,
      status,
      shipping_type,
      shipping_provider,
      shipping_carrier,
      tracking_code,
      shipping_status,
      shipping_data,
      customer_phone,
      order_items(
        id,
        product_id,
        quantity,
        unit_price,
        products(name)
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("No encontramos el pedido.");
  }

  let profile = null;

  if (order.user_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle();
    profile = data || null;
  }

  return {
    ...order,
    profiles: profile,
  } as ShipmentOrder;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Faltan variables de entorno de Supabase." },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const access = await assertAdminOrInternal(request, supabase);

  if (!access.ok) {
    return jsonResponse({ error: access.error }, access.status);
  }

  const body = await request.json().catch(() => ({}));
  const orderFromBody = body.order && typeof body.order === "object"
    ? body.order as ShipmentOrder
    : null;
  const orderId = String(body.orderId || orderFromBody?.id || "").trim();
  const force = Boolean(body.force);

  if (!orderId) {
    return jsonResponse({ error: "Falta orderId." }, 400);
  }

  try {
    const order = orderFromBody || await loadOrder(supabase, orderId);
    const providerName = providerForOrder(order);

    if (providerName === "manual") {
      return jsonResponse({
        error: "El pedido esta configurado con envio manual.",
      }, 400);
    }

    if (order.tracking_code && !force) {
      return jsonResponse({
        orderId,
        provider: providerName,
        trackingCode: order.tracking_code,
        shippingStatus: order.shipping_status || "pending",
        skipped: true,
      });
    }

    const provider = getShippingProviderForOrder(order);
    const shipment = await provider.createShipment(order);

    const shippingData = mergeShippingData(order.shipping_data, {
      provider: providerName,
      shipment: shipment.raw,
      label_url: shipment.labelUrl || null,
      label_base64: shipment.labelBase64 || null,
      shipment_created_at: new Date().toISOString(),
    });

    const orderStatus =
      shipment.trackingCode && shipment.shippingStatus !== "pending"
        ? "enviado_por_correo"
        : "preparando_pedido";

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        shipping_provider: providerName,
        shipping_carrier: providerName,
        tracking_code: shipment.trackingCode,
        shipping_status: shipment.shippingStatus,
        shipping_data: shippingData,
        status: orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      orderId,
      provider: providerName,
      trackingCode: shipment.trackingCode,
      shippingStatus: shipment.shippingStatus,
      labelUrl: shipment.labelUrl || null,
      labelBase64: shipment.labelBase64 || null,
      raw: shipment.raw,
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "No pudimos crear el envio.",
    }, 502);
  }
});
