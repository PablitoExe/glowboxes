const checkoutItemsContainer = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutDiscount = document.getElementById("checkoutDiscount");
const checkoutTax = document.getElementById("checkoutTax");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutMeta = document.getElementById("checkoutMeta");
const paymentAccountLink = document.getElementById("paymentAccountLink");
const paymentAccountLinkLabel = paymentAccountLink?.querySelector("span");
const paymentStatus = document.getElementById("paymentStatus");
const paymentSubmit = document.getElementById("paymentSubmit");
const paymentMethods = document.querySelectorAll("[data-payment-method]");
const shippingMethods = document.querySelectorAll("[data-shipping-type]");
const paymentMethodTitle = document.getElementById("paymentMethodTitle");
const paymentMethodDescription = document.getElementById("paymentMethodDescription");
const paymentMethodHint = document.getElementById("paymentMethodHint");
const payerName = document.getElementById("payerName");
const payerEmail = document.getElementById("payerEmail");
const payerPhone = document.getElementById("payerPhone");
const paymentCustomerName = document.getElementById("paymentCustomerName");
const paymentCustomerMeta = document.getElementById("paymentCustomerMeta");
const paymentLoginHint = document.getElementById("paymentLoginHint");
const transferReceiptPanel = document.getElementById("transferReceiptPanel");
const transferReceipt = document.getElementById("transferReceipt");
const receiptFileLabel = document.getElementById("receiptFileLabel");

const checkoutStorageKey = "glow-checkout";
const guestCartStorageKey = "glow-cart";
const paymentSurchargeRate = 0.066;
const paymentSurchargeMethods = new Set(["mercadopago"]);

const paymentCopy = {
  mercadopago: {
    title: "Mercado Pago",
    description: "Paga con tarjeta, debito, credito, saldo o cuotas.",
    hint: "Incluye recargo de pago.",
    buttonLabel: "Abrir Mercado Pago"
  },
  transfer: {
    title: "Transferencia",
    description: "Subi el comprobante para registrar tu pedido.",
    hint: "Sin recargo.",
    buttonLabel: "Registrar pedido"
  }
};

let activePaymentMethod = "mercadopago";
let activeShippingType = "delivery";
let currentCheckout = null;
let currentProfile = null;
let isSubmittingOrder = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 0
  })}`;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeAssetPath(path) {
  return String(path || "").replace(/^img\//, "assets/img/");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mergeCheckoutItems(items) {
  const grouped = new Map();

  items.forEach(item => {
    const identity = item.productId || item.image || `${normalizeText(item.name)}-${Number(item.priceValue || 0)}`;
    const existing = grouped.get(identity);

    if (existing) {
      existing.quantity += Math.max(1, Number(item.quantity || 1));
      return;
    }

    grouped.set(identity, {
      ...item,
      key: item.productId || item.key || identity,
      quantity: Math.max(1, Number(item.quantity || 1))
    });
  });

  return [...grouped.values()];
}

function paymentSurchargeFor(method, baseAmount) {
  if (!paymentSurchargeMethods.has(method)) {
    return 0;
  }

  return roundMoney(Math.max(0, Number(baseAmount || 0)) * paymentSurchargeRate);
}

function checkoutTotalsForMethod(checkout, method = activePaymentMethod) {
  if (!checkout) {
    return {
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0
    };
  }

  const subtotal = Number(checkout.subtotal || 0);
  const discount = Number(checkout.discount || 0);
  const baseTax = Number(checkout.baseTax ?? checkout.tax ?? 0);
  const baseAmount = Math.max(0, subtotal - discount + baseTax);
  const surcharge = paymentSurchargeFor(method, baseAmount);

  return {
    subtotal,
    discount,
    tax: roundMoney(baseTax + surcharge),
    total: roundMoney(baseAmount + surcharge)
  };
}

function readStoredCollection(key, storage) {
  try {
    const rawValue = storage.getItem(key);
    const parsed = rawValue ? JSON.parse(rawValue) : null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function normalizeCheckout(rawCheckout) {
  const rawItems = Array.isArray(rawCheckout?.items) ? rawCheckout.items : [];
  const items = mergeCheckoutItems(rawItems.map(item => ({
    key: String(item?.key || item?.productId || item?.name || "").trim(),
    productId: item?.productId ? String(item.productId) : null,
    name: String(item?.name || "Producto").trim(),
    priceValue: Number(item?.priceValue || 0),
    quantity: Math.max(1, Number(item?.quantity || 1)),
    image: item?.image ? normalizeAssetPath(item.image) : null
  })).filter(item => item.key && item.name));

  if (!items.length) {
    return null;
  }

  const subtotal = Number(rawCheckout?.subtotal || 0) || items.reduce((sum, item) => {
    return sum + item.priceValue * item.quantity;
  }, 0);
  const discount = Number(rawCheckout?.discount || 0);
  const tax = Number(rawCheckout?.tax || 0);
  const total = Number(rawCheckout?.total || 0) || Math.max(0, subtotal - discount + tax);

  return {
    createdAt: rawCheckout?.createdAt || new Date().toISOString(),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    subtotal,
    discount,
    baseTax: tax,
    tax,
    total
  };
}

function loadGuestCheckout() {
  const storedCart = readStoredCollection(guestCartStorageKey, window.localStorage);
  if (!Array.isArray(storedCart) || !storedCart.length) {
    return null;
  }

  return normalizeCheckout({
    items: storedCart.map(item => ({
      key: item?.key,
      productId: item?.productId,
      name: item?.name,
      priceValue: item?.priceValue,
      quantity: item?.quantity,
      image: item?.image
    }))
  });
}

async function resolveCheckout() {
  const storedCheckout = normalizeCheckout(readStoredCollection(checkoutStorageKey, window.sessionStorage));
  if (storedCheckout) {
    return storedCheckout;
  }

  if (window.GlowDB?.listCartItems) {
    const accountCart = await window.GlowDB.listCartItems();

    if (accountCart.length > 0) {
      return normalizeCheckout({
        items: accountCart.map(item => ({
          key: item.product_id,
          productId: item.product_id,
          name: item.products?.name || "Producto",
          priceValue: Number(item.products?.price || 0),
          quantity: Number(item.quantity || 1),
          image: item.products?.image_path
        }))
      });
    }
  }

  return loadGuestCheckout();
}

function setAccountButton(profile) {
  if (!paymentAccountLink || !paymentAccountLinkLabel) return;

  if (!profile) {
    paymentAccountLink.href = "auth.html?redirect=pasarela.html";
    paymentAccountLinkLabel.textContent = "Iniciar sesion";
    return;
  }

  if (profile.role === "admin") {
    paymentAccountLink.href = "dashboard.html";
    paymentAccountLinkLabel.textContent = "Dashboard";
    return;
  }

  paymentAccountLink.href = "mi-cuenta.html";
  paymentAccountLinkLabel.textContent = "Mi cuenta";
}

function setPaymentMessage(text, type = "info") {
  if (!paymentStatus) return;

  paymentStatus.textContent = text;
  paymentStatus.className = `payment-status is-${type}`;
}

function renderMethodCopy() {
  const method = paymentCopy[activePaymentMethod] || paymentCopy.mercadopago;

  paymentMethods.forEach(button => {
    button.classList.toggle("active", button.dataset.paymentMethod === activePaymentMethod);
  });

  if (paymentMethodTitle) {
    paymentMethodTitle.textContent = method.title;
  }

  if (paymentMethodDescription) {
    paymentMethodDescription.textContent = method.description;
  }

  if (paymentMethodHint) {
    paymentMethodHint.textContent = method.hint;
  }

  if (paymentSubmit) {
    paymentSubmit.textContent = method.buttonLabel;
  }

  if (transferReceiptPanel) {
    transferReceiptPanel.hidden = activePaymentMethod !== "transfer";
  }

  renderCheckout(currentCheckout);
}

function renderShippingType() {
  shippingMethods.forEach(button => {
    button.classList.toggle("active", button.dataset.shippingType === activeShippingType);
  });
}

function renderCustomer(profile) {
  const profileName = profile?.full_name || profile?.email || "Invitado";

  if (paymentCustomerName) {
    paymentCustomerName.textContent = profileName;
  }

  if (paymentCustomerMeta) {
    paymentCustomerMeta.textContent = profile
      ? `${profile.email || "Cuenta Glow Boxes"} - ${profile.role === "admin" ? "Administrador" : "Cliente"}`
      : "Checkout como invitado";
  }

  if (payerName) {
    payerName.value = profile?.full_name || "";
  }

  if (payerEmail) {
    payerEmail.value = profile?.email || "";
  }

  if (payerPhone) {
    payerPhone.value = "";
  }

  if (paymentLoginHint) {
    paymentLoginHint.innerHTML = profile
      ? "Tu cuenta esta conectada."
      : `Para comprar necesitas <a href="auth.html?redirect=pasarela.html">iniciar sesion o registrarte</a>.`;
  }
}

function sanitizeFileName(value) {
  return String(value || "comprobante")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uploadTransferReceipt() {
  if (activePaymentMethod !== "transfer") return null;

  const file = transferReceipt?.files?.[0];
  if (!file) {
    throw new Error("Subi el comprobante de transferencia para continuar.");
  }

  const safeName = sanitizeFileName(file.name);
  const path = `${currentProfile.id}/${Date.now()}-${safeName}`;
  const { error } = await window.GlowDB.client.storage
    .from("payment-receipts")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  return path;
}

function renderEmptyState() {
  if (checkoutItemsContainer) {
    checkoutItemsContainer.innerHTML = `
      <article class="empty-checkout">
        <h3>No hay productos listos para cobrar</h3>
        <p>Agrega productos al carrito para continuar.</p>
        <a href="index.html">Ir a la tienda</a>
      </article>
    `;
  }

  if (checkoutMeta) {
    checkoutMeta.textContent = "Sin productos.";
  }

  checkoutSubtotal.textContent = formatMoney(0);
  checkoutDiscount.textContent = formatMoney(0);
  checkoutTax.textContent = formatMoney(0);
  checkoutTotal.textContent = formatMoney(0);
  paymentSubmit.disabled = false;
  paymentSubmit.textContent = "Volver a comprar";
  setPaymentMessage("Agrega productos para continuar.", "warning");
}

function renderSavedOrderState(orderId) {
  const shortId = String(orderId || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "SIN ID";

  if (checkoutItemsContainer) {
    checkoutItemsContainer.innerHTML = `
      <article class="empty-checkout">
        <h3>Pedido #${shortId} registrado</h3>
        <p>Ya podes verlo en tu historial.</p>
        <a href="mi-cuenta.html">Ver mi historial</a>
      </article>
    `;
  }

  if (checkoutMeta) {
    checkoutMeta.textContent = `Pedido #${shortId} registrado.`;
  }

  checkoutSubtotal.textContent = formatMoney(0);
  checkoutDiscount.textContent = formatMoney(0);
  checkoutTax.textContent = formatMoney(0);
  checkoutTotal.textContent = formatMoney(0);
  paymentSubmit.disabled = true;
  paymentSubmit.textContent = "Pedido registrado";
}

function renderCheckout(checkout) {
  if (!checkout) {
    renderEmptyState();
    return;
  }

  if (checkoutMeta) {
    checkoutMeta.textContent = `${checkout.itemCount} producto${checkout.itemCount === 1 ? "" : "s"}`;
  }

  if (checkoutItemsContainer) {
    checkoutItemsContainer.innerHTML = checkout.items.map(item => {
      const media = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
        : `<div class="checkout-item-placeholder">${escapeHtml(item.name.charAt(0).toUpperCase())}</div>`;
      const totalPrice = item.priceValue * item.quantity;

      return `
        <article class="checkout-item">
          ${media}
          <div class="checkout-item-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${item.quantity} unidad${item.quantity === 1 ? "" : "es"} - ${formatMoney(item.priceValue)} c/u</span>
          </div>
          <strong class="checkout-item-total">${formatMoney(totalPrice)}</strong>
        </article>
      `;
    }).join("");
  }

  const totals = checkoutTotalsForMethod(checkout);

  checkoutSubtotal.textContent = formatMoney(totals.subtotal);
  checkoutDiscount.textContent = formatMoney(totals.discount);
  checkoutTax.textContent = formatMoney(totals.tax);
  checkoutTotal.textContent = formatMoney(totals.total);
  setPaymentMessage("Revisa el total y confirma el pago.", "success");
}

async function persistOrder() {
  if (!window.GlowDB?.client || !currentCheckout || !currentProfile?.id) {
    return { data: null, error: "Necesitas iniciar sesion para registrar el pedido." };
  }

  let receiptPath = null;

  try {
    receiptPath = await uploadTransferReceipt();
  } catch (error) {
    return { data: null, error: error.message };
  }

  const totals = checkoutTotalsForMethod(currentCheckout);

  const { data: order, error: orderError } = await window.GlowDB.client
    .from("orders")
    .insert({
      user_id: currentProfile.id,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      status: "pedido_recibido",
      shipping_type: activeShippingType,
      payment_method: activePaymentMethod,
      payment_status: receiptPath ? "comprobante_cargado" : "pendiente",
      payment_receipt_path: receiptPath,
      customer_phone: String(payerPhone?.value || "").trim() || null
    })
    .select("id")
    .single();

  if (orderError) {
    if (receiptPath) {
      await window.GlowDB.client.storage
        .from("payment-receipts")
        .remove([receiptPath]);
    }

    return { data: null, error: orderError.message };
  }

  const itemsPayload = mergeCheckoutItems(currentCheckout.items).map(item => ({
    order_id: order.id,
    product_id: item.productId || null,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.priceValue || 0)
  }));

  const { error: itemsError } = await window.GlowDB.client
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) {
    await window.GlowDB.client
      .from("orders")
      .delete()
      .eq("id", order.id);

    return { data: null, error: itemsError.message };
  }

  await window.GlowDB.client
    .from("cart_items")
    .delete()
    .eq("user_id", currentProfile.id);

  window.sessionStorage.removeItem(checkoutStorageKey);
  currentCheckout = null;
  return { data: order, error: null };
}

async function createMercadoPagoPreference(orderId) {
  if (!window.GlowDB?.client) {
    return { data: null, error: "Supabase no esta configurado." };
  }

  const { data, error } = await window.GlowDB.client.functions.invoke("create-mercadopago-preference", {
    body: {
      orderId,
      origin: window.location.origin
    }
  });

  if (error) {
    console.error("Mercado Pago Edge Function error:", error);

    let functionMessage = error.message || "";

    if (error.context && typeof error.context.json === "function") {
      try {
        const errorBody = await error.context.json();
        functionMessage = errorBody?.error || errorBody?.message || functionMessage;
      } catch (parseError) {
        console.error("No pudimos leer el detalle de la funcion:", parseError);
      }
    }

    return {
      data: null,
      error: functionMessage
        ? `La funcion de Mercado Pago respondio: ${functionMessage}`
        : "No pudimos abrir Mercado Pago."
    };
  }

  if (!data?.checkoutUrl) {
    console.error("Mercado Pago preference response without checkoutUrl:", data);
    return { data: null, error: data?.error || "Mercado Pago no devolvio una URL de checkout." };
  }

  return { data, error: null };
}

async function initPaymentPage() {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  const user = window.GlowDB?.getCurrentUser
    ? await window.GlowDB.getCurrentUser()
    : null;

  currentProfile = user && window.GlowDB?.getOwnProfile
    ? await window.GlowDB.getOwnProfile()
    : null;

  if (!currentProfile?.id) {
    window.location.href = "auth.html?redirect=pasarela.html";
    return;
  }

  setAccountButton(currentProfile);
  renderCustomer(currentProfile);
  renderMethodCopy();
  renderShippingType();

  currentCheckout = await resolveCheckout();
  renderCheckout(currentCheckout);
}

paymentMethods.forEach(button => {
  button.addEventListener("click", () => {
    activePaymentMethod = button.dataset.paymentMethod || "mercadopago";
    renderMethodCopy();
  });
});

shippingMethods.forEach(button => {
  button.addEventListener("click", () => {
    activeShippingType = button.dataset.shippingType || "delivery";
    renderShippingType();
  });
});

transferReceipt?.addEventListener("change", () => {
  const file = transferReceipt.files?.[0];
  if (receiptFileLabel) {
    receiptFileLabel.textContent = file ? file.name : "Subir comprobante";
  }
});

paymentSubmit.addEventListener("click", async () => {
  if (!currentCheckout) {
    window.location.href = "index.html";
    return;
  }

  if (isSubmittingOrder) return;

  const payerReady = String(payerName?.value || "").trim() && String(payerEmail?.value || "").trim();
  if (!payerReady) {
    setPaymentMessage("Completa nombre y email.", "warning");
    return;
  }

  if (!currentProfile?.id) {
    window.location.href = "auth.html?redirect=pasarela.html";
    return;
  }

  if (activePaymentMethod === "transfer" && !transferReceipt?.files?.[0]) {
    setPaymentMessage("Subi el comprobante para continuar.", "warning");
    return;
  }

  isSubmittingOrder = true;
  paymentSubmit.disabled = true;

  const { data: savedOrder, error } = await persistOrder();

  if (error) {
    isSubmittingOrder = false;
    paymentSubmit.disabled = false;
    setPaymentMessage(`No pudimos registrar el pedido: ${error}`, "warning");
    return;
  }

  if (activePaymentMethod === "transfer") {
    const orderId = encodeURIComponent(savedOrder.id);
    window.location.href = `mi-cuenta.html?payment=transfer_review&order=${orderId}#compras`;
    return;
  }

  if (activePaymentMethod === "mercadopago") {
    setPaymentMessage("Pedido registrado. Estamos abriendo Mercado Pago...", "success");
    const { data: preference, error: preferenceError } = await createMercadoPagoPreference(savedOrder.id);

    if (preferenceError) {
      isSubmittingOrder = false;
      paymentSubmit.disabled = false;
      setPaymentMessage(`Pedido #${String(savedOrder.id).slice(0, 8).toUpperCase()} registrado. ${preferenceError}`, "warning");
      return;
    }

    window.location.href = preference.checkoutUrl;
    return;
  }

  renderSavedOrderState(savedOrder.id);
  setPaymentMessage(`Pedido #${String(savedOrder.id).slice(0, 8).toUpperCase()} registrado.`, "success");
  isSubmittingOrder = false;
});

initPaymentPage();
