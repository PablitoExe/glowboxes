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

function orderStatusMeta(status) {
  const normalizedStatus = String(status || "pendiente").toLowerCase();

  if (normalizedStatus === "pagado") {
    return {
      label: "Pagado",
      className: "is-pagado"
    };
  }

  if (normalizedStatus === "enviado") {
    return {
      label: "Enviado",
      className: "is-enviado"
    };
  }

  if (normalizedStatus === "cancelado") {
    return {
      label: "Cancelado",
      className: "is-cancelado"
    };
  }

  return {
    label: "Pendiente",
    className: "is-pendiente"
  };
}

function normalizeOrder(order) {
  const items = Array.isArray(order.order_items)
    ? order.order_items.map(item => {
      const productName = item.products?.name || `Producto ${shortOrderId(item.product_id)}`;

      return {
        id: item.id,
        name: productName,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        totalPrice: Number(item.unit_price || 0) * Number(item.quantity || 0),
        image: normalizeAssetPath(item.products?.image_path)
      };
    })
    : [];

  return {
    id: order.id,
    createdAt: order.created_at,
    status: String(order.status || "pendiente").toLowerCase(),
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
  const inProgress = allOrders.filter(order => order.status === "pendiente" || order.status === "pagado").length;
  const latestOrder = allOrders[0] || null;
  const profileName = profile?.full_name || profile?.email || "Glow Boxes";

  sidebarName.textContent = profileName;
  sidebarEmail.textContent = profile?.email || "Sin email";
  if (customerAvatar) {
    customerAvatar.textContent = initialsFromName(profileName);
  }
  welcomeMessage.textContent = latestOrder
    ? `${profileName}, aca tenes un resumen rapido de tus ${allOrders.length} pedido${allOrders.length === 1 ? "" : "s"} y el detalle completo de cada compra.`
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
      <article class="order-card">
        <header class="order-card-head">
          <div>
            <span class="order-code">Pedido #${escapeHtml(shortOrderId(order.id))}</span>
            <h3>${order.itemsCount} producto${order.itemsCount === 1 ? "" : "s"}</h3>
            <p>${escapeHtml(formatDate(order.createdAt))}</p>
          </div>
          <span class="status-pill ${status.className}">${status.label}</span>
        </header>

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
            <span>Impuestos</span>
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
      </article>
    `;
  }).join("");
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
}

initCustomerDashboard();
