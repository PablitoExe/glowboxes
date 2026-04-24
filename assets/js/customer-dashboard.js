const sidebarName = document.getElementById("customerSidebarName");
const sidebarEmail = document.getElementById("customerSidebarEmail");
const customerAvatar = document.getElementById("customerAvatar");
const welcomeMessage = document.getElementById("customerWelcomeMessage");
const lastOrderTitle = document.getElementById("lastOrderTitle");
const lastOrderMeta = document.getElementById("lastOrderMeta");
const lastOrderTotal = document.getElementById("lastOrderTotal");
const metricOrders = document.getElementById("metricOrders");
const metricSpent = document.getElementById("metricSpent");
const metricInProgress = document.getElementById("metricInProgress");
const metricLastPurchase = document.getElementById("metricLastPurchase");
const ordersCountLabel = document.getElementById("ordersCountLabel");
const ordersList = document.getElementById("ordersList");
const refreshOrdersButton = document.getElementById("refreshOrdersButton");
const logoutButton = document.getElementById("logoutButton");
const filterButtons = document.querySelectorAll("[data-status-filter]");
const sidebarNavLinks = document.querySelectorAll(".sidebar-nav a");

let activeStatusFilter = "all";
let allOrders = [];
let currentCustomerProfile = null;
let returnNoticeShown = false;

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

function formatDate(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  } catch (error) {
    return "Sin fecha";
  }
}

function shortOrderId(value) {
  return String(value || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "SIN ID";
}

function initialsFromName(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map(word => word.charAt(0).toUpperCase()).join("") || "GB";
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

function mergeOrderItems(items) {
  const grouped = new Map();

  items.forEach(item => {
    const identity = item.productId || item.image || `${normalizeText(item.name)}-${Number(item.unitPrice || 0)}`;
    const existing = grouped.get(identity);

    if (existing) {
      existing.quantity += Number(item.quantity || 0);
      existing.totalPrice = existing.quantity * existing.unitPrice;
      return;
    }

    grouped.set(identity, {
      ...item,
      quantity: Number(item.quantity || 0),
      totalPrice: Number(item.unitPrice || 0) * Number(item.quantity || 0)
    });
  });

  return [...grouped.values()];
}

function orderStatusMeta(status) {
  const meta = window.GlowOrders?.getStatusMeta
    ? window.GlowOrders.getStatusMeta(status)
    : { label: "Pedido recibido", colorClass: "is-process" };

  return {
    label: meta.label,
    className: meta.colorClass || "is-process"
  };
}

function normalizeOrder(order) {
  const items = mergeOrderItems(Array.isArray(order.order_items)
    ? order.order_items.map(item => {
      const productName = item.products?.name || `Producto ${shortOrderId(item.product_id)}`;

      return {
        id: item.id,
        productId: item.product_id ? String(item.product_id) : null,
        name: productName,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        totalPrice: Number(item.unit_price || 0) * Number(item.quantity || 0),
        image: normalizeAssetPath(item.products?.image_path)
      };
    })
    : []);

  return {
    id: order.id,
    createdAt: order.created_at,
    updatedAt: order.updated_at || order.created_at,
    status: window.GlowOrders?.normalizeStatus
      ? window.GlowOrders.normalizeStatus(order.status)
      : String(order.status || "pedido_recibido").toLowerCase(),
    shipping_type: window.GlowOrders?.normalizeShippingType
      ? window.GlowOrders.normalizeShippingType(order.shipping_type)
      : "delivery",
    shipping_provider: order.shipping_provider || order.shipping_carrier || "manual",
    shipping_carrier: order.shipping_carrier || "",
    tracking_code: order.tracking_code || "",
    shipping_status: order.shipping_status || "pending",
    shipping_data: order.shipping_data || null,
    history: window.GlowOrders?.historyFor ? window.GlowOrders.historyFor(order) : [],
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
    items,
    itemsCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  };
}

function filteredOrders() {
  if (activeStatusFilter === "all") {
    return allOrders;
  }

  return allOrders.filter(order => order.status === activeStatusFilter);
}

function setOrdersCountLabel(visibleCount) {
  if (allOrders.length === visibleCount) {
    ordersCountLabel.textContent = `${visibleCount} pedido${visibleCount === 1 ? "" : "s"}`;
    return;
  }

  ordersCountLabel.textContent = `${visibleCount} de ${allOrders.length} pedido${allOrders.length === 1 ? "" : "s"}`;
}

function renderSummary(profile) {
  const totalSpent = allOrders.reduce((sum, order) => sum + order.total, 0);
  const inProgress = allOrders.filter(order => {
    return window.GlowOrders?.isOrderActive
      ? window.GlowOrders.isOrderActive(order.status)
      : order.status !== "entregado_completado";
  }).length;
  const latestOrder = allOrders[0] || null;
  const profileName = profile?.full_name || profile?.email || "Glow Boxes";

  sidebarName.textContent = profileName;
  sidebarEmail.textContent = profile?.email || "Sin email";
  if (customerAvatar) {
    customerAvatar.textContent = initialsFromName(profileName);
  }
  welcomeMessage.textContent = latestOrder
    ? `${profileName}, aca tenes un resumen rapido de tus ${allOrders.length} pedido${allOrders.length === 1 ? "" : "s"}, con tracking visual e historial de cambios.`
    : `${profileName}, todavia no vemos compras registradas en tu cuenta. Cuando hagas tu primer pedido va a aparecer aca con el detalle completo.`;

  metricOrders.textContent = allOrders.length;
  metricSpent.textContent = formatMoney(totalSpent);
  metricInProgress.textContent = inProgress;
  metricLastPurchase.textContent = latestOrder ? formatDate(latestOrder.createdAt) : "Sin fecha";

  if (!latestOrder) {
    lastOrderTitle.textContent = "Todavia no registras compras";
    lastOrderMeta.textContent = "Explora la tienda y cuando hagas tu primer pedido te va a quedar guardado aca.";
    lastOrderTotal.textContent = formatMoney(0);
    return;
  }

  const latestStatus = orderStatusMeta(latestOrder.status);
  lastOrderTitle.textContent = `Pedido #${shortOrderId(latestOrder.id)} - ${latestStatus.label}`;
  lastOrderMeta.textContent = `${latestOrder.itemsCount} producto${latestOrder.itemsCount === 1 ? "" : "s"} - ${formatDate(latestOrder.createdAt)}`;
  lastOrderTotal.textContent = formatMoney(latestOrder.total);
}

function renderEmptyState() {
  if (allOrders.length === 0) {
    ordersList.innerHTML = `
      <article class="empty-state">
        <h3>Aun no hay compras en tu cuenta</h3>
        <p>Cuando cierres tu primer pedido lo vas a poder seguir desde este panel, con fechas, montos y el detalle de cada producto.</p>
        <a href="index.html">Ir a la tienda</a>
      </article>
    `;
    setOrdersCountLabel(0);
    return true;
  }

  if (filteredOrders().length === 0) {
    ordersList.innerHTML = `
      <article class="empty-state">
        <h3>No hay pedidos con este filtro</h3>
        <p>Cambia el estado seleccionado para revisar el resto de tus compras registradas.</p>
        <button class="refresh-button" type="button" data-reset-filters="true">Ver todos los pedidos</button>
      </article>
    `;
    setOrdersCountLabel(0);
    return true;
  }

  return false;
}

function renderOrders() {
  const orders = filteredOrders();

  if (renderEmptyState()) {
    return;
  }

  setOrdersCountLabel(orders.length);

  ordersList.innerHTML = orders.map(order => {
    const status = orderStatusMeta(order.status);
    const workflowMeta = window.GlowOrders?.getStatusMeta
      ? window.GlowOrders.getStatusMeta(order.status)
      : { description: "" };
    const shippingLabel = window.GlowOrders?.shippingLabels?.[order.shipping_type] || "Delivery";
    const carrierLabel = order.shipping_carrier === "andreani"
      ? "Andreani"
      : order.shipping_carrier === "correo" || order.shipping_carrier === "via_cargo"
        ? "Correo Argentino"
        : "";
    const timelineMarkup = window.GlowOrders?.buildTimelineMarkup
      ? window.GlowOrders.buildTimelineMarkup(order, escapeHtml)
      : "";
    const historyMarkup = order.history.length
      ? order.history.slice().reverse().map(entry => {
        const historyStatus = window.GlowOrders?.getStatusMeta
          ? window.GlowOrders.getStatusMeta(entry.status)
          : { label: entry.status };

        return `
          <li>
            <span>${escapeHtml(historyStatus.label)}</span>
            <time>${escapeHtml(window.GlowOrders?.formatDateTime ? window.GlowOrders.formatDateTime(entry.timestamp) : formatDate(entry.timestamp))}</time>
          </li>
        `;
      }).join("")
      : `<li><span>Sin historial visible</span><time>Esperando sincronizacion</time></li>`;
    const itemsMarkup = order.items.length
      ? order.items.map(item => {
        const media = item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
          : `<div class="order-item-placeholder">${escapeHtml(item.name.charAt(0).toUpperCase())}</div>`;

        return `
          <article class="order-item">
            ${media}
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${item.quantity} unidad${item.quantity === 1 ? "" : "es"} - ${formatMoney(item.unitPrice)} c/u</small>
            </div>
            <span class="order-item-price">${formatMoney(item.totalPrice)}</span>
          </article>
        `;
      }).join("")
      : `<p class="order-card-empty">Este pedido no tiene items visibles.</p>`;

    return `
      <article class="order-card" data-order-id="${escapeHtml(order.id)}">
        <header class="order-card-head">
          <div>
            <span class="order-code">Pedido #${escapeHtml(shortOrderId(order.id))}</span>
            <h3>${order.itemsCount} producto${order.itemsCount === 1 ? "" : "s"}</h3>
            <p>${escapeHtml(formatDate(order.createdAt))} - ${escapeHtml(carrierLabel ? `${shippingLabel} / ${carrierLabel}` : shippingLabel)}</p>
          </div>
          ${window.GlowOrders?.isOrderActive?.(order.status) ? `<span class="active-order-badge">Activo</span>` : ""}
          <span class="status-pill ${status.className}">${status.label}</span>
        </header>

        <section class="order-live-status">
          <span class="order-live-icon">${escapeHtml(workflowMeta.icon || "✓")}</span>
          <div>
            <strong>${escapeHtml(status.label)}</strong>
            <p>${escapeHtml(workflowMeta.description || "Estado actualizado del pedido.")}</p>
            ${order.tracking_code ? `<small>Tracking: ${escapeHtml(order.tracking_code)}</small>` : ""}
          </div>
        </section>

        ${timelineMarkup}

        <section class="order-summary-grid">
          <article>
            <span>Subtotal</span>
            <strong>${formatMoney(order.subtotal)}</strong>
          </article>
          <article>
            <span>Descuento</span>
            <strong>${formatMoney(order.discount)}</strong>
          </article>
          <article>
            <span>Recargo de pago</span>
            <strong>${formatMoney(order.tax)}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>${formatMoney(order.total)}</strong>
          </article>
        </section>

        <section class="order-items">
          ${itemsMarkup}
        </section>

        <section class="order-history">
          <h4>Historial de cambios</h4>
          <ul>${historyMarkup}</ul>
        </section>
      </article>
    `;
  }).join("");
}

function showCustomerToast(message, duration = 4200) {
  const toast = document.createElement("div");
  toast.className = "order-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("show"), 20);
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 250);
  }, duration);
}

function focusOrderFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");

  if (!orderId || !ordersList) return;

  window.location.hash = "#compras";
  syncSidebarNavigation();

  const orderCard = ordersList.querySelector(`[data-order-id="${CSS.escape(orderId)}"]`);

  if (orderCard) {
    orderCard.classList.add("is-highlighted");
    orderCard.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => orderCard.classList.remove("is-highlighted"), 4200);
  }
}

async function confirmMercadoPagoReturn(params) {
  if (!window.GlowDB?.client || params.get("payment") !== "success") {
    return null;
  }

  const orderId = params.get("order");
  const paymentId = params.get("payment_id") || params.get("collection_id");

  if (!orderId || !paymentId) {
    return null;
  }

  const { data, error } = await window.GlowDB.client.functions.invoke("confirm-mercadopago-payment", {
    body: {
      orderId,
      paymentId
    }
  });

  if (error || data?.error) {
    console.error("No pudimos confirmar Mercado Pago:", error || data);
    return {
      type: "warning",
      message: "No pudimos confirmar el pago todavia. Revisa el estado en unos minutos."
    };
  }

  if (data?.paymentStatus === "aprobado") {
    return {
      type: "success",
      message: "Pago aprobado. Ya podes ver tu pedido."
    };
  }

  return {
    type: "warning",
    message: "El pago quedo pendiente. Te avisaremos cuando se acredite."
  };
}

async function handlePaymentReturn() {
  if (returnNoticeShown) return;

  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");

  if (!payment) return;

  returnNoticeShown = true;

  if (payment === "transfer_review") {
    showCustomerToast("Pedido registrado. Nuestro equipo va a revisar que el pago haya llegado.", 5600);
    focusOrderFromUrl();
    return;
  }

  if (payment === "failure") {
    showCustomerToast("El pago no se completo. Podes volver a intentarlo.", 5200);
    focusOrderFromUrl();
    return;
  }

  if (payment === "pending") {
    showCustomerToast("El pago quedo pendiente. Te avisaremos cuando se acredite.", 5200);
    focusOrderFromUrl();
    return;
  }

  const confirmation = await confirmMercadoPagoReturn(params);

  if (confirmation) {
    await loadOrders(currentCustomerProfile);
    showCustomerToast(confirmation.message, confirmation.type === "success" ? 4800 : 5600);
  }

  focusOrderFromUrl();
}

function setActiveFilter(nextFilter) {
  activeStatusFilter = nextFilter;

  filterButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.statusFilter === nextFilter);
  });

  renderOrders();
}

function syncSidebarNavigation() {
  const currentHash = window.location.hash || "#resumen";

  sidebarNavLinks.forEach(link => {
    const href = link.getAttribute("href") || "";
    const isSectionLink = href.startsWith("#");
    link.classList.toggle("active", isSectionLink && href === currentHash);
  });
}

async function requireCustomerSession() {
  if (!window.GlowDB?.client) {
    window.location.href = "auth.html?redirect=mi-cuenta.html";
    return null;
  }

  const { data } = await window.GlowDB.client.auth.getSession();
  const session = data.session;

  if (!session) {
    window.location.href = "auth.html?redirect=mi-cuenta.html";
    return null;
  }

  const profile = window.GlowDB.getOwnProfile
    ? await window.GlowDB.getOwnProfile()
    : null;

  if (profile?.role === "admin") {
    window.location.href = "dashboard.html";
    return null;
  }

  return {
    user: session.user,
    profile: profile || {
      full_name: session.user.user_metadata?.full_name || session.user.email || "Glow Boxes",
      email: session.user.email || "",
      role: "cliente"
    }
  };
}

async function loadOrders(profile) {
  currentCustomerProfile = profile || currentCustomerProfile;
  refreshOrdersButton.disabled = true;
  refreshOrdersButton.textContent = "Actualizando...";

  const orders = window.GlowDB.listOwnOrders
    ? await window.GlowDB.listOwnOrders()
    : [];

  allOrders = orders.map(normalizeOrder);
  renderSummary(currentCustomerProfile);
  renderOrders();

  refreshOrdersButton.disabled = false;
  refreshOrdersButton.textContent = "Actualizar";
}

function notifyOrderUpdate(payload) {
  const nextStatus = window.GlowOrders?.getStatusMeta
    ? window.GlowOrders.getStatusMeta(payload?.new?.status)
    : { label: "Pedido actualizado" };
  const message = `Pedido #${shortOrderId(payload?.new?.id)} actualizado: ${nextStatus.label}`;
  showCustomerToast(message, 3600);
}

function startOrderRealtime() {
  if (!window.GlowDB?.client) return;

  window.GlowDB.client
    .channel("customer-orders-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async (payload) => {
      notifyOrderUpdate(payload);
      await loadOrders(currentCustomerProfile);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, async () => {
      await loadOrders(currentCustomerProfile);
    })
    .subscribe();

  window.setInterval(async () => {
    await loadOrders(currentCustomerProfile);
  }, 45000);
}

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.statusFilter);
  });
});

refreshOrdersButton.addEventListener("click", async () => {
  const profile = window.GlowDB.getOwnProfile
    ? await window.GlowDB.getOwnProfile()
    : null;

  await loadOrders(profile || currentCustomerProfile);
});

ordersList.addEventListener("click", (event) => {
  const resetButton = event.target.closest("[data-reset-filters]");
  if (!resetButton) return;

  setActiveFilter("all");
});

sidebarNavLinks.forEach(link => {
  link.addEventListener("click", () => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    sidebarNavLinks.forEach(item => item.classList.toggle("active", item === link));
  });
});

window.addEventListener("hashchange", syncSidebarNavigation);

logoutButton.addEventListener("click", async () => {
  if (window.GlowDB?.client) {
    await window.GlowDB.client.auth.signOut();
  }

  window.location.href = "auth.html";
});

async function initCustomerDashboard() {
  const sessionData = await requireCustomerSession();
  if (!sessionData) return;

  currentCustomerProfile = sessionData.profile;
  renderSummary(currentCustomerProfile);
  renderOrders();
  syncSidebarNavigation();
  await loadOrders(currentCustomerProfile);
  await handlePaymentReturn();
  startOrderRealtime();
}

initCustomerDashboard();
