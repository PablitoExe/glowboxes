import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckoutItemInput = {
  productId?: unknown;
  quantity?: unknown;
};

const allowedPaymentMethods = new Set(["mercadopago", "transfer"]);
const allowedShippingTypes = new Set(["delivery", "correo", "retiro"]);
const allowedCarriers = new Set(["andreani", "correo"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeQuantity(value: unknown) {
  const quantity = Math.floor(Number(value || 1));
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, 99);
}

function normalizeItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const grouped = new Map<string, number>();

  rawItems.forEach((item: CheckoutItemInput) => {
    const productId = String(item?.productId || "").trim();
    if (!productId) return;

    grouped.set(
      productId,
      (grouped.get(productId) || 0) + normalizeQuantity(item?.quantity),
    );
  });

  return [...grouped.entries()].map(([productId, quantity]) => ({
    product_id: productId,
    quantity,
  }));
}

async function receiptExists(
  supabase: ReturnType<typeof createClient>,
  receiptPath: string,
) {
  const parts = receiptPath.split("/").filter(Boolean);
  const fileName = parts.pop();
  const folder = parts.join("/");

  if (!fileName || !folder) {
    return false;
  }

  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .list(folder, {
      limit: 1,
      search: fileName,
    });

  if (error) {
    throw error;
  }

  return Boolean(data?.some((item) => item.name === fileName));
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

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return jsonResponse({ error: "Necesitas iniciar sesion." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ error: "Sesion invalida." }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const items = normalizeItems(body.items);
  const paymentMethod = String(body.paymentMethod || "mercadopago").trim();
  const shippingType = String(body.shippingType || "delivery").trim();
  const shippingCarrier = String(body.shippingCarrier || "andreani").trim();
  const receiptPath = String(body.receiptPath || "").trim() || null;
  const customerPhone = String(body.customerPhone || "").trim() || null;

  if (!items.length) {
    return jsonResponse({ error: "El pedido no tiene productos validos." }, 400);
  }

  if (!allowedPaymentMethods.has(paymentMethod)) {
    return jsonResponse({ error: "Metodo de pago invalido." }, 400);
  }

  if (!allowedShippingTypes.has(shippingType)) {
    return jsonResponse({ error: "Tipo de envio invalido." }, 400);
  }

  if (shippingType === "correo" && !allowedCarriers.has(shippingCarrier)) {
    return jsonResponse({ error: "Correo invalido." }, 400);
  }

  if (paymentMethod === "transfer" && !receiptPath) {
    return jsonResponse(
      { error: "Subi el comprobante de transferencia para continuar." },
      400,
    );
  }

  if (receiptPath && !receiptPath.startsWith(`${user.id}/`)) {
    return jsonResponse({ error: "Comprobante invalido." }, 403);
  }

  if (receiptPath) {
    try {
      const exists = await receiptExists(supabase, receiptPath);

      if (!exists) {
        return jsonResponse(
          { error: "No encontramos el comprobante de transferencia subido." },
          400,
        );
      }
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error
            ? error.message
            : "No pudimos validar el comprobante.",
        },
        500,
      );
    }
  }

  const { data, error } = await supabase.rpc("create_order_with_stock", {
    p_user_id: user.id,
    p_items: items,
    p_payment_method: paymentMethod,
    p_shipping_type: shippingType,
    p_shipping_carrier: shippingCarrier,
    p_receipt_path: receiptPath,
    p_customer_phone: customerPhone,
  });

  if (error || !data) {
    return jsonResponse({
      error: error?.message || "No pudimos registrar el pedido.",
    }, 400);
  }

  return jsonResponse(data);
});
