import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

type OrderItem = {
  quantity: number;
  unit_price: number;
  products?: {
    name?: string | null;
  } | null;
};

type Order = {
  id: string;
  user_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_status: string;
  shipping_type: string;
  customer_phone: string | null;
  created_at: string;
  invoice_email_sent_at?: string | null;
  invoice_email_to?: string | null;
  order_items?: OrderItem[];
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: unknown) {
  return `$${
    Number(value || 0).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }`;
}

function shortOrderId(orderId: string) {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function paymentLabel(method: string) {
  if (method === "transfer") return "Transferencia";
  if (method === "mercadopago") return "Mercado Pago";
  return method || "Pago";
}

async function assertAccess(
  request: Request,
  supabase: SupabaseClient,
  order: Order,
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

  if (order.user_id === user.id) {
    return { ok: true, status: 200, error: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    return { ok: true, status: 200, error: null };
  }

  return { ok: false, status: 403, error: "No podes enviar esta factura." };
}

async function loadOrder(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      user_id,
      subtotal,
      discount,
      tax,
      total,
      payment_method,
      payment_status,
      shipping_type,
      customer_phone,
      created_at,
      invoice_email_sent_at,
      invoice_email_to,
      order_items(
        quantity,
        unit_price,
        products(name)
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error("No encontramos el pedido.");
  }

  return data as Order;
}

async function loadRecipient(
  supabase: SupabaseClient,
  order: Order,
  explicitEmail: unknown,
) {
  const fromBody = String(explicitEmail || "").trim();

  if (fromBody) {
    return fromBody;
  }

  if (!order.user_id) {
    throw new Error("El pedido no tiene usuario asociado.");
  }

  const { data, error } = await supabase.auth.admin.getUserById(order.user_id);

  if (error || !data?.user?.email) {
    throw new Error("No pudimos obtener el email del cliente.");
  }

  return data.user.email;
}

function buildInvoiceHtml(order: Order, toEmail: string) {
  const rows = (order.order_items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const lineTotal = quantity * unitPrice;

    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">${
      escapeHtml(item.products?.name || "Producto")
    }</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${
      formatMoney(unitPrice)
    }</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${
      formatMoney(lineTotal)
    }</td>
      </tr>
    `;
  }).join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1d1730;line-height:1.45;">
      <h1 style="margin:0 0 8px;font-size:28px;">Glow Boxes</h1>
      <p style="margin:0 0 22px;color:#6a607b;">Comprobante de compra #${
    shortOrderId(order.id)
  }</p>

      <div style="padding:16px;border:1px solid #eee;border-radius:12px;background:#faf8ff;margin-bottom:18px;">
        <strong>Pedido:</strong> #${shortOrderId(order.id)}<br>
        <strong>Fecha:</strong> ${
    new Date(order.created_at).toLocaleString("es-AR")
  }<br>
        <strong>Email:</strong> ${escapeHtml(toEmail)}<br>
        <strong>Pago:</strong> ${
    escapeHtml(paymentLabel(order.payment_method))
  } (${escapeHtml(order.payment_status)})<br>
        <strong>Envio:</strong> ${escapeHtml(order.shipping_type)}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;">Producto</th>
            <th style="text-align:center;padding-bottom:8px;">Cant.</th>
            <th style="text-align:right;padding-bottom:8px;">Unit.</th>
            <th style="text-align:right;padding-bottom:8px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-left:auto;max-width:280px;">
        <p style="display:flex;justify-content:space-between;margin:6px 0;"><span>Subtotal</span><strong>${
    formatMoney(order.subtotal)
  }</strong></p>
        <p style="display:flex;justify-content:space-between;margin:6px 0;"><span>Descuento</span><strong>${
    formatMoney(order.discount)
  }</strong></p>
        <p style="display:flex;justify-content:space-between;margin:6px 0;"><span>Recargos / impuestos</span><strong>${
    formatMoney(order.tax)
  }</strong></p>
        <p style="display:flex;justify-content:space-between;margin:12px 0 0;font-size:20px;"><span>Total</span><strong>${
    formatMoney(order.total)
  }</strong></p>
      </div>

      <p style="margin-top:24px;color:#6a607b;font-size:13px;">
        Este comprobante confirma tu compra en Glow Boxes. No reemplaza una factura fiscal AFIP.
      </p>
    </div>
  `;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("INVOICE_FROM_EMAIL");
  const replyTo = Deno.env.get("INVOICE_REPLY_TO") || undefined;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!resendApiKey || !fromEmail || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      error: "Faltan variables para enviar facturas por email.",
    }, 500);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const force = Boolean(body.force);

  if (!orderId) {
    return jsonResponse({ error: "Falta orderId." }, 400);
  }

  try {
    const order = await loadOrder(supabase, orderId);
    const access = await assertAccess(request, supabase, order);

    if (!access.ok) {
      return jsonResponse({ error: access.error }, access.status);
    }

    if (order.invoice_email_sent_at && !force) {
      return jsonResponse({
        orderId,
        skipped: true,
        emailTo: order.invoice_email_to,
      });
    }

    const toEmail = await loadRecipient(supabase, order, body.email);
    const html = buildInvoiceHtml(order, toEmail);
    const subject = `Glow Boxes - Comprobante #${shortOrderId(order.id)}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: replyTo,
        subject,
        html,
      }),
    });

    const emailResult = await response.json().catch(() => ({}));

    if (!response.ok) {
      return jsonResponse({
        error: emailResult?.message || "No pudimos enviar el email.",
        details: emailResult,
      }, 502);
    }

    await supabase
      .from("orders")
      .update({
        invoice_email_sent_at: new Date().toISOString(),
        invoice_email_to: toEmail,
        invoice_email_provider_id: String(emailResult?.id || ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return jsonResponse({
      orderId,
      emailTo: toEmail,
      providerId: emailResult?.id || null,
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "No pudimos enviar la factura.",
    }, 500);
  }
});
