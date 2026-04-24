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
const paymentMethodTitle = document.getElementById("paymentMethodTitle");
const paymentMethodDescription = document.getElementById("paymentMethodDescription");
const paymentMethodHint = document.getElementById("paymentMethodHint");
const payerName = document.getElementById("payerName");
const payerEmail = document.getElementById("payerEmail");
const paymentCustomerName = document.getElementById("paymentCustomerName");
const paymentCustomerMeta = document.getElementById("paymentCustomerMeta");
const paymentLoginHint = document.getElementById("paymentLoginHint");

const checkoutStorageKey = "glow-checkout";
const guestCartStorageKey = "glow-cart";

const paymentCopy = {
  mercadopago: {
    title: "Mercado Pago",
    description: "Ideal para una salida rapida a una pasarela externa con validacion segura y cuotas.",
    hint: "Preparado para conectar un checkout externo sin perder el resumen del pedido.",
    buttonLabel: "Abrir Mercado Pago"
  },
  card: {
    title: "Tarjeta bancaria",
    description: "Perfecto para integrar una pasarela propia con tarjetas, debito y credito en el mismo flujo.",
    hint: "La interfaz ya esta lista para engancharla al proveedor que elijas.",
    buttonLabel: "Pagar con tarjeta"
  },
  transfer: {
    title: "Transferencia",
    description: "Una alternativa manual para mostrar alias, CVU y pedir comprobante sin salir del sitio.",
    hint: "Sirve muy bien para validaciones internas o ventas por mayor.",
    buttonLabel: "Ver datos de transferencia"
  }
};

let activePaymentMethod = "mercadopago";
let currentCheckout = null;
let currentProfile = null;

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

function normalizeAssetPath(path) {
  return String(path || "").replace(/^img\//, "assets/img/");
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
  const items = rawItems.map(item => ({
    key: String(item?.key || item?.productId || item?.name || "").trim(),
    productId: item?.productId ? String(item.productId) : null,
    name: String(item?.name || "Producto").trim(),
    priceValue: Number(item?.priceValue || 0),
    quantity: Math.max(1, Number(item?.quantity || 1)),
    image: item?.image ? normalizeAssetPath(item.image) : null
  })).filter(item => item.key && item.name);

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

  if (paymentLoginHint) {
    paymentLoginHint.innerHTML = profile
      ? "Tu cuenta ya esta conectada. Cuando integremos el pago real, este checkout va a poder dejar la compra asociada automaticamente."
      : `Si queres que la compra aparezca en tu historial, <a href="auth.html?redirect=pasarela.html">inicia sesion antes de pagar</a>.`;
  }
}

function renderEmptyState() {
  if (checkoutItemsContainer) {
    checkoutItemsContainer.innerHTML = `
      <article class="empty-checkout">
        <h3>No hay productos listos para cobrar</h3>
        <p>Volve a la tienda, carga tu carrito y cuando cierres la animacion del boton vas a aterrizar otra vez aca.</p>
        <a href="index.html">Ir a la tienda</a>
      </article>
    `;
  }

  if (checkoutMeta) {
    checkoutMeta.textContent = "Todavia no hay un pedido preparado.";
  }

  checkoutSubtotal.textContent = formatMoney(0);
  checkoutDiscount.textContent = formatMoney(0);
  checkoutTax.textContent = formatMoney(0);
  checkoutTotal.textContent = formatMoney(0);
  paymentSubmit.disabled = false;
  paymentSubmit.textContent = "Volver a comprar";
  setPaymentMessage("Tu pasarela ya esta lista. Solo falta armar el carrito para traer un pedido real.", "warning");
}

function renderCheckout(checkout) {
  if (!checkout) {
    renderEmptyState();
    return;
  }

  if (checkoutMeta) {
    checkoutMeta.textContent = `${checkout.itemCount} producto${checkout.itemCount === 1 ? "" : "s"} listos para pagar`;
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

  checkoutSubtotal.textContent = formatMoney(checkout.subtotal);
  checkoutDiscount.textContent = formatMoney(checkout.discount);
  checkoutTax.textContent = formatMoney(checkout.tax);
  checkoutTotal.textContent = formatMoney(checkout.total);
  setPaymentMessage("El pedido ya llego desde la tienda. Ahora tenes una pasarela propia y prolija para continuar el cobro.", "success");
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

  setAccountButton(currentProfile);
  renderCustomer(currentProfile);
  renderMethodCopy();

  currentCheckout = await resolveCheckout();
  renderCheckout(currentCheckout);
}

paymentMethods.forEach(button => {
  button.addEventListener("click", () => {
    activePaymentMethod = button.dataset.paymentMethod || "mercadopago";
    renderMethodCopy();
  });
});

paymentSubmit.addEventListener("click", () => {
  if (!currentCheckout) {
    window.location.href = "index.html";
    return;
  }

  const payerReady = String(payerName?.value || "").trim() && String(payerEmail?.value || "").trim();
  const copy = paymentCopy[activePaymentMethod] || paymentCopy.mercadopago;

  if (!payerReady) {
    setPaymentMessage("Completa nombre y email para dejar listo el paso a la pasarela.", "warning");
    return;
  }

  if (activePaymentMethod === "transfer") {
    setPaymentMessage("Tu checkout quedo preparado para transferencia. El proximo paso es mostrar alias, CVU y validacion de comprobante.", "success");
    return;
  }

  setPaymentMessage(`${copy.title} ya tiene el resumen del pedido listo. Cuando quieras, el siguiente paso es conectar la redireccion real al proveedor.`, "success");
});

initPaymentPage();
