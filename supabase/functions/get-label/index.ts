import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  getShippingProvider,
  normalizeShippingProvider
} from "../_shared/shipping/index.ts";

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

async function accessForOrder(
  supabase: ReturnType<typeof createClient>,
  token: string,
  orderId: string
) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);

  if (userError || !user) return { allowed: false, admin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") return { allowed: true, admin: true };

  if (!orderId) return { allowed: false, admin: false };

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { allowed: Boolean(order), admin: false };
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
    return jsonResponse({ error: "Faltan variables de entorno de Supabase." }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const trackingCode = String(body.tracking_code || body.trackingCode || "").trim();
  const providerName = normalizeShippingProvider(body.provider || body.shipping_provider);
  const orderId = String(body.orderId || "").trim();

  if (!trackingCode || providerName === "manual") {
    return jsonResponse({ error: "Faltan tracking_code y provider valido." }, 400);
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const access = await accessForOrder(supabase, token, orderId);

  if (!access.allowed) {
    return jsonResponse({ error: "No podes consultar esta etiqueta." }, 403);
  }

  try {
    const provider = getShippingProvider(providerName);
    const label = await provider.getLabel(trackingCode);

    if (orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("shipping_data")
        .eq("id", orderId)
        .maybeSingle();

      const base = order?.shipping_data && typeof order.shipping_data === "object"
        ? order.shipping_data as Record<string, unknown>
        : {};

      await supabase
        .from("orders")
        .update({
          shipping_data: {
            ...base,
            label_url: label.labelUrl || base.label_url || null,
            label_base64: label.labelBase64 || base.label_base64 || null,
            label_content_type: label.contentType,
            last_label_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);
    }

    return jsonResponse(label);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "No pudimos obtener la etiqueta."
    }, 502);
  }
});
