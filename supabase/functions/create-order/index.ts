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

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  stock: number | null;
  active: boolean;
};

const paymentSurchargeRate = 0.066;
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

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
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
    productId,
    quantity,
  }));
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

  const productIds = items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, stock, active")
    .in("id", productIds);

  if (productsError) {
    return jsonResponse({ error: productsError.message }, 500);
  }

  const productsById = new Map(
    ((products || []) as ProductRow[]).map((product) => [product.id, product]),
  );

  for (const item of items) {
    const product = productsById.get(item.productId);

    if (!product || !product.active) {
      return jsonResponse(
        { error: "Uno de los productos ya no esta disponible." },
        400,
      );
    }

    const stock = Number(product.stock ?? 0);
    if (Number.isFinite(stock) && stock >= 0 && item.quantity > stock) {
      return jsonResponse(
        { error: `No hay stock suficiente de ${product.name}.` },
        400,
      );
    }
  }

  const subtotal = roundMoney(items.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    return sum + Number(product?.price || 0) * item.quantity;
  }, 0));
  const discount = 0;
  const baseTax = 0;
  const surcharge = paymentMethod === "mercadopago"
    ? roundMoney((subtotal - discount + baseTax) * paymentSurchargeRate)
    : 0;
  const tax = roundMoney(baseTax + surcharge);
  const total = roundMoney(Math.max(0, subtotal - discount + tax));

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      subtotal,
      discount,
      tax,
      total,
      status: "pedido_recibido",
      shipping_type: shippingType,
      shipping_provider: shippingType === "correo" ? shippingCarrier : "manual",
      shipping_carrier: shippingType === "correo" ? shippingCarrier : null,
      shipping_status: "pending",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "transfer"
        ? "comprobante_cargado"
        : "pendiente",
      payment_receipt_path: receiptPath,
      customer_phone: customerPhone,
    })
    .select("id, subtotal, discount, tax, total")
    .single();

  if (orderError || !order) {
    return jsonResponse(
      { error: orderError?.message || "No pudimos registrar el pedido." },
      500,
    );
  }

  const itemsPayload = items.map((item) => {
    const product = productsById.get(item.productId);

    return {
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: Number(product?.price || 0),
    };
  });

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return jsonResponse({ error: itemsError.message }, 500);
  }

  await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id);

  return jsonResponse({
    order,
    totals: {
      subtotal,
      discount,
      tax,
      total,
    },
  });
});
