const dashboardShell = document.querySelector(".dashboard-shell");
const menuButton = document.querySelector(".menu-button");
const productForm = document.getElementById("productForm");
const brandForm = document.getElementById("brandForm");
const categoryForm = document.getElementById("categoryForm");
const staffForm = document.getElementById("staffForm");
const brandSelect = document.getElementById("brandSelect");
const categorySelect = document.getElementById("categorySelect");
const loadedBrands = document.getElementById("loadedBrands");
const loadedBrandsCount = document.getElementById("loadedBrandsCount");
const loadedCategories = document.getElementById("loadedCategories");
const loadedCategoriesCount = document.getElementById("loadedCategoriesCount");
const loadedProducts = document.getElementById("loadedProducts");
const loadedProductsCount = document.getElementById("loadedProductsCount");
const featuredProducts = document.getElementById("featuredProducts");
const featuredProductsCount = document.getElementById("featuredProductsCount");
const productSubmit = document.getElementById("productSubmit");
const cancelProductEdit = document.getElementById("cancelProductEdit");
const staffSubmit = document.getElementById("staffSubmit");
const cancelStaffEdit = document.getElementById("cancelStaffEdit");
const productImageInput = document.getElementById("productImageInput");
const productCostValue = document.getElementById("productCostValue");
const productProfitValue = document.getElementById("productProfitValue");
const productProfitHint = document.getElementById("productProfitHint");
const logoutButton = document.getElementById("logoutButton");
const dashboardUserName = document.getElementById("dashboardUserName");
const dashboardUserRole = document.getElementById("dashboardUserRole");
const dashboardAvatar = document.querySelector(".avatar");
const sectionLinks = document.querySelectorAll("[data-section-link]");
const navGroups = document.querySelectorAll(".nav-group");
const navGroupToggles = document.querySelectorAll("[data-nav-group-toggle]");
const dashboardSections = document.querySelectorAll(".dashboard-section");
const analyticsProducts = document.getElementById("analyticsProducts");
const analyticsStock = document.getElementById("analyticsStock");
const analyticsInventory = document.getElementById("analyticsInventory");
const analyticsBrands = document.getElementById("analyticsBrands");
const analyticsCategoriesCount = document.getElementById("analyticsCategoriesCount");
const analyticsCategories = document.getElementById("analyticsCategories");
const analyticsLowStock = document.getElementById("analyticsLowStock");
const staffMembers = document.getElementById("staffMembers");
const staffMembersCount = document.getElementById("staffMembersCount");
const staffActiveCount = document.getElementById("staffActiveCount");
const staffDeliveryCount = document.getElementById("staffDeliveryCount");
const staffRoleCount = document.getElementById("staffRoleCount");
const adminOrders = document.getElementById("adminOrders");
const adminOrdersCount = document.getElementById("adminOrdersCount");
const adminOrdersTotal = document.getElementById("adminOrdersTotal");
const adminOrdersPending = document.getElementById("adminOrdersPending");
const adminOrdersRevenue = document.getElementById("adminOrdersRevenue");
let loadedProductCache = [];
let loadedBrandCache = [];
let loadedCategoryCache = [];
let loadedStaffCache = [];
let loadedOrderCache = [];

async function requireDashboardSession() {
  if (!window.GlowDB?.client) {
    window.location.href = "auth.html?redirect=dashboard.html";
    return false;
  }

  const { data } = await window.GlowDB.client.auth.getSession();
  const session = data.session;

  if (!session) {
    window.location.href = "auth.html?redirect=dashboard.html";
    return false;
  }

  const user = session.user;
  const { data: profile, error } = await window.GlowDB.client
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin") {
    await window.GlowDB.client.auth.signOut();
    alert("No tenes permisos para entrar al dashboard.");
    window.location.href = "auth.html";
    return false;
  }

  const fullName = profile.full_name || user.user_metadata?.full_name || user.email || "Glow Boxes";

  if (dashboardUserName) {
    dashboardUserName.textContent = fullName;
  }

  if (dashboardUserRole) {
    dashboardUserRole.textContent = "Administrador";
  }

  if (dashboardAvatar) {
    dashboardAvatar.textContent = initialsFromName(fullName);
  }

  return true;
}

function initialsFromName(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map(word => word.charAt(0).toUpperCase()).join("") || "GB";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDashboardPrice(value) {
  return Number(value || 0).toLocaleString("es-AR");
}

function formatDashboardMoney(value) {
  return `$${formatDashboardPrice(value)}`;
}

function formatDashboardDate(value) {
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

function shortDashboardId(value) {
  return String(value || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "SIN ID";
}

function staffRoleLabel(role) {
  const labels = {
    empleado: "Empleado",
    delivery: "Delivery",
    cajero: "Cajero",
    encargado: "Encargado",
    administracion: "Administracion"
  };

  return labels[role] || "Personal";
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

function productImage(product) {
  return String(product.image_path || "assets/img/logo.png").replace(/^img\//, "assets/img/");
}

function normalizeFinancialRow(product) {
  const financial = Array.isArray(product.product_financials)
    ? product.product_financials[0]
    : product.product_financials;

  return {
    ...product,
    cost_price: Number(financial?.cost_price || 0)
  };
}

async function fetchAdminProducts() {
  if (!window.GlowDB?.client) return [];

  const { data, error } = await window.GlowDB.client
    .from("products")
    .select(`
      id,
      name,
      description,
      price,
      image_path,
      stock,
      is_featured,
      gradient_start,
      gradient_end,
      brand_id,
      category_id,
      brands(name),
      categories(name),
      product_financials(cost_price)
    `)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("No se pudieron cargar los datos financieros privados. Usando carga publica.", error);
    const fallbackProducts = await window.GlowDB.listProducts();
    return fallbackProducts.map(product => ({
      ...product,
      cost_price: 0
    }));
  }

  return (data || []).map(normalizeFinancialRow);
}

function staffCardMarkup(member) {
  const statusText = member.active ? "Activo" : "Inactivo";
  const safeRole = escapeHtml(staffRoleLabel(member.role));
  const safeName = escapeHtml(member.full_name || "Sin nombre");
  const safeEmail = escapeHtml(member.email || "Sin email");
  const safePhone = escapeHtml(member.phone || "Sin telefono");
  const safeZone = escapeHtml(member.zone || "Sin zona");
  const safeNotes = escapeHtml(member.notes || "Sin notas");
  const createdAt = member.created_at
    ? new Date(member.created_at).toLocaleDateString("es-AR")
    : "Sin fecha";

  return `
    <article class="staff-card ${member.active ? "is-active" : "is-inactive"}">
      <div class="staff-card-top">
        <div class="staff-avatar">${escapeHtml(initialsFromName(member.full_name))}</div>
        <div class="staff-headline">
          <div class="staff-headline-row">
            <h3>${safeName}</h3>
            <span class="staff-role-badge">${safeRole}</span>
          </div>
          <div class="staff-meta">
            <span>${safeEmail}</span>
            <span>${safePhone}</span>
          </div>
        </div>
      </div>

      <div class="staff-detail-grid">
        <div>
          <strong>Zona</strong>
          <small>${safeZone}</small>
        </div>
        <div>
          <strong>Estado</strong>
          <small>${statusText}</small>
        </div>
        <div>
          <strong>Alta</strong>
          <small>${createdAt}</small>
        </div>
      </div>

      <p class="staff-notes">${safeNotes}</p>

      <div class="staff-actions">
        <button class="edit-staff" type="button" data-id="${escapeHtml(member.id)}">Editar</button>
        <button class="toggle-staff ${member.active ? "active" : ""}" type="button" data-id="${escapeHtml(member.id)}">
          ${member.active ? "Pasar a inactivo" : "Reactivar"}
        </button>
        <button class="delete-staff" type="button" data-id="${escapeHtml(member.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function orderCardMarkup(order) {
  const status = orderStatusMeta(order.status);
  const customerName = escapeHtml(order.customer_name || "Cliente sin nombre");
  const itemsMarkup = order.items.length
    ? order.items.map(item => {
      const imageMarkup = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
        : `<div class="admin-order-item-placeholder">${escapeHtml(item.name.charAt(0).toUpperCase())}</div>`;

      return `
        <article class="admin-order-item">
          ${imageMarkup}
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.quantity} unidad${item.quantity === 1 ? "" : "es"} - ${formatDashboardMoney(item.unit_price)} c/u</small>
          </div>
          <span>${formatDashboardMoney(item.quantity * item.unit_price)}</span>
        </article>
      `;
    }).join("")
    : `<p class="loaded-product-empty">No hay items cargados en este pedido.</p>`;

  return `
    <article class="admin-order-card">
      <div class="admin-order-head">
        <div>
          <span class="topbar-kicker">Pedido #${shortDashboardId(order.id)}</span>
          <h3>${customerName}</h3>
          <p>${formatDashboardDate(order.created_at)} · ${order.items_count} producto${order.items_count === 1 ? "" : "s"}</p>
        </div>
        <div class="admin-order-head-side">
          <span class="status-pill ${status.className}">${status.label}</span>
          <strong>${formatDashboardMoney(order.total)}</strong>
        </div>
      </div>

      <div class="admin-order-summary">
        <div>
          <span>Subtotal</span>
          <strong>${formatDashboardMoney(order.subtotal)}</strong>
        </div>
        <div>
          <span>Descuento</span>
          <strong>${formatDashboardMoney(order.discount)}</strong>
        </div>
        <div>
          <span>Impuestos</span>
          <strong>${formatDashboardMoney(order.tax)}</strong>
        </div>
      </div>

      <div class="admin-order-controls">
        <label>
          Estado
          <select class="order-status-select" data-id="${escapeHtml(order.id)}">
            <option value="pendiente" ${order.status === "pendiente" ? "selected" : ""}>Pendiente</option>
            <option value="pagado" ${order.status === "pagado" ? "selected" : ""}>Pagado</option>
            <option value="enviado" ${order.status === "enviado" ? "selected" : ""}>Enviado</option>
            <option value="cancelado" ${order.status === "cancelado" ? "selected" : ""}>Cancelado</option>
          </select>
        </label>
      </div>

      <div class="admin-order-items">
        ${itemsMarkup}
      </div>
    </article>
  `;
}

function productCardMarkup(product) {
  return `
    <article class="loaded-product-card ${product.is_featured ? "is-featured" : ""}">
      <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}">
      <div>
        <div class="loaded-product-topline">
          <h3>${escapeHtml(product.name)}</h3>
          ${product.is_featured ? `<span class="featured-pill">Destacado</span>` : ""}
        </div>
        <p>${escapeHtml(product.description || "Sin descripcion")}</p>
        <div class="loaded-product-meta">
          <span>$${formatDashboardPrice(product.price)}</span>
          <span>Stock ${product.stock ?? 0}</span>
        </div>
        <div class="loaded-product-gradient" style="--start: ${escapeHtml(product.gradient_start || "#ff2da0")}; --end: ${escapeHtml(product.gradient_end || "#7b2cff")};"></div>
        <div class="loaded-product-actions">
          <button class="toggle-featured ${product.is_featured ? "active" : ""}" type="button" data-id="${escapeHtml(product.id)}">
            ${product.is_featured ? "Quitar del home" : "Destacar en home"}
          </button>
          <button class="edit-product" type="button" data-id="${escapeHtml(product.id)}">
            Editar
          </button>
          <button class="delete-product" type="button" data-id="${escapeHtml(product.id)}">
            Eliminar
          </button>
        </div>
      </div>
    </article>
  `;
}

function resetProductForm() {
  productForm.reset();
  productForm.dataset.editingId = "";
  productForm.dataset.currentImage = "";
  productSubmit.textContent = "Guardar producto";
  cancelProductEdit.hidden = true;
  productImageInput.required = true;
  if (productForm.elements.cost_price) {
    productForm.elements.cost_price.value = "";
  }
  updateProductFinanceSummary();
}

function resetStaffForm() {
  if (!staffForm) return;

  staffForm.reset();
  staffForm.dataset.editingId = "";
  staffForm.elements.role.value = "empleado";
  staffForm.elements.active.value = "true";
  if (staffSubmit) {
    staffSubmit.textContent = "Guardar personal";
  }
  if (cancelStaffEdit) {
    cancelStaffEdit.hidden = true;
  }
}

function renderOptions(select, items, emptyText) {
  if (!select) return;

  if (!items.length) {
    select.innerHTML = `<option value="">${emptyText}</option>`;
    return;
  }

  select.innerHTML = items
    .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");
}

async function saveBrandOrder(brands) {
  if (!window.GlowDB?.client) return false;

  const updates = brands.map((brand, index) => {
    return window.GlowDB.client
      .from("brands")
      .update({ sort_order: index + 1 })
      .eq("id", brand.id);
  });

  const results = await Promise.all(updates);
  const failed = results.find(result => result.error);

  if (failed?.error) {
    alert(`No se pudo actualizar el orden de marcas: ${failed.error.message}`);
    console.error(failed.error);
    return false;
  }

  return true;
}

async function moveBrand(brandId, direction) {
  const orderedBrands = [...loadedBrandCache];
  const currentIndex = orderedBrands.findIndex(item => item.id === brandId);
  if (currentIndex === -1) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= orderedBrands.length) return;

  const [brand] = orderedBrands.splice(currentIndex, 1);
  orderedBrands.splice(targetIndex, 0, brand);

  const saved = await saveBrandOrder(orderedBrands);
  if (!saved) return;

  await loadDashboardOptions();
  await renderBrandsAndCategories();
  alert("Orden de marcas actualizado.");
}

async function uploadDashboardImage(file, folder) {
  if (!window.GlowDB?.client || !file || file.size === 0) return null;

  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filePath = `${folder}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await window.GlowDB.client.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = window.GlowDB.client.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

function getStoragePathFromUrl(publicUrl) {
  if (!publicUrl || !window.GlowDB?.client) return null;

  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/product-images/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch (error) {
    return null;
  }
}

async function deleteDashboardImage(publicUrl) {
  const storagePath = getStoragePathFromUrl(publicUrl);
  if (!storagePath || !window.GlowDB?.client) return;

  const { error } = await window.GlowDB.client
    .storage
    .from("product-images")
    .remove([storagePath]);

  if (error) {
    console.error("No se pudo borrar archivo de storage:", error);
  }
}

async function loadDashboardOptions() {
  if (!window.GlowDB?.client) {
    renderOptions(brandSelect, [], "Supabase no configurado");
    renderOptions(categorySelect, [], "Supabase no configurado");
    return;
  }

  const [brands, categories] = await Promise.all([
    window.GlowDB.listBrands(),
    window.GlowDB.listCategories()
  ]);

  renderOptions(brandSelect, brands, "No hay marcas");
  renderOptions(categorySelect, categories, "No hay categorias");
}

async function renderBrandsAndCategories() {
  if (!loadedBrands || !loadedCategories) return;

  if (!window.GlowDB?.client) {
    loadedBrands.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    loadedCategories.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    loadedBrandsCount.textContent = "0 marcas";
    loadedCategoriesCount.textContent = "0 categorias";
    return;
  }

  const [brands, categories] = await Promise.all([
    window.GlowDB.listBrands(),
    window.GlowDB.listCategories()
  ]);

  loadedBrandCache = brands;
  loadedCategoryCache = categories;
  loadedBrandsCount.textContent = `${brands.length} marca${brands.length === 1 ? "" : "s"}`;
  loadedCategoriesCount.textContent = `${categories.length} categoria${categories.length === 1 ? "" : "s"}`;

  loadedBrands.innerHTML = brands.length
    ? brands.map(brand => `
      <article class="mini-card">
        <div class="mini-card-info">
          ${brand.logo_path ? `<img src="${escapeHtml(String(brand.logo_path).replace(/^img\//, "assets/img/"))}" alt="${escapeHtml(brand.name)}">` : ""}
          <div>
            <strong>${escapeHtml(brand.name)}</strong>
            <small>Orden ${brand.sort_order ?? 100} · ${brand.logo_path ? "Con logo" : "Sin logo"}</small>
          </div>
        </div>
        <div class="mini-card-actions">
          <button type="button" class="order-brand" data-id="${escapeHtml(brand.id)}" data-direction="-1">↑</button>
          <button type="button" class="order-brand" data-id="${escapeHtml(brand.id)}" data-direction="1">↓</button>
          <button type="button" class="delete-brand" data-id="${escapeHtml(brand.id)}">Eliminar</button>
        </div>
      </article>
    `).join("")
    : `<p class="loaded-product-empty">Todavia no hay marcas cargadas.</p>`;

  loadedCategories.innerHTML = categories.length
    ? categories.map(category => `
      <article class="mini-card">
        <div class="mini-card-info">
          <div>
            <strong>${escapeHtml(category.name)}</strong>
            <small>Categoria activa</small>
          </div>
        </div>
        <button type="button" class="delete-category" data-id="${escapeHtml(category.id)}">Eliminar</button>
      </article>
    `).join("")
    : `<p class="loaded-product-empty">Todavia no hay categorias cargadas.</p>`;
}

async function renderLoadedProducts() {
  if (!loadedProducts || !featuredProducts) return;

  if (!window.GlowDB?.client) {
    loadedProducts.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    featuredProducts.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    loadedProductsCount.textContent = "0 productos";
    featuredProductsCount.textContent = "0 destacados";
    return;
  }

  const products = await fetchAdminProducts();
  loadedProductCache = products;
  const featured = products.filter(product => product.is_featured);
  loadedProductsCount.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  featuredProductsCount.textContent = `${featured.length} destacado${featured.length === 1 ? "" : "s"}`;

  featuredProducts.innerHTML = featured.length
    ? featured.map(productCardMarkup).join("")
    : `<p class="loaded-product-empty">Todavia no hay productos destacados para el home.</p>`;

  if (products.length === 0) {
    loadedProducts.innerHTML = `<p class="loaded-product-empty">Todavia no hay productos cargados.</p>`;
    return;
  }

  loadedProducts.innerHTML = products.map(productCardMarkup).join("");
}

async function renderStaffMembers() {
  if (!staffMembers || !staffMembersCount) return;

  if (!window.GlowDB?.client) {
    staffMembers.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    staffMembersCount.textContent = "0 personas";
    if (staffActiveCount) staffActiveCount.textContent = "0 personas";
    if (staffDeliveryCount) staffDeliveryCount.textContent = "0 deliverys";
    if (staffRoleCount) staffRoleCount.textContent = "0 roles";
    return;
  }

  const { data, error } = await window.GlowDB.client
    .from("staff_members")
    .select("id, full_name, email, phone, role, zone, notes, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("No se pudo cargar el personal:", error);
    staffMembers.innerHTML = `<p class="loaded-product-empty">No pudimos cargar el personal. Si acabas de agregar esta funcion, ejecuta el SQL nuevo en Supabase.</p>`;
    staffMembersCount.textContent = "0 personas";
    if (staffActiveCount) staffActiveCount.textContent = "0 personas";
    if (staffDeliveryCount) staffDeliveryCount.textContent = "0 deliverys";
    if (staffRoleCount) staffRoleCount.textContent = "0 roles";
    return;
  }

  loadedStaffCache = data || [];
  const activeMembers = loadedStaffCache.filter(member => member.active);
  const deliveryMembers = loadedStaffCache.filter(member => member.role === "delivery");
  const distinctRoles = new Set(loadedStaffCache.map(member => member.role).filter(Boolean));

  staffMembersCount.textContent = `${loadedStaffCache.length} persona${loadedStaffCache.length === 1 ? "" : "s"}`;
  if (staffActiveCount) {
    staffActiveCount.textContent = `${activeMembers.length} persona${activeMembers.length === 1 ? "" : "s"}`;
  }
  if (staffDeliveryCount) {
    staffDeliveryCount.textContent = `${deliveryMembers.length} delivery${deliveryMembers.length === 1 ? "" : "s"}`;
  }
  if (staffRoleCount) {
    staffRoleCount.textContent = `${distinctRoles.size} rol${distinctRoles.size === 1 ? "" : "es"}`;
  }

  staffMembers.innerHTML = loadedStaffCache.length
    ? loadedStaffCache.map(staffCardMarkup).join("")
    : `<p class="loaded-product-empty">Todavia no hay personal cargado.</p>`;
}

async function renderAdminOrders() {
  if (!adminOrders || !adminOrdersCount) return;

  if (!window.GlowDB?.client) {
    adminOrders.innerHTML = `<p class="loaded-product-empty">Supabase no esta configurado.</p>`;
    adminOrdersCount.textContent = "0 pedidos";
    if (adminOrdersTotal) adminOrdersTotal.textContent = "0 pedidos";
    if (adminOrdersPending) adminOrdersPending.textContent = "0 pendientes";
    if (adminOrdersRevenue) adminOrdersRevenue.textContent = formatDashboardMoney(0);
    return;
  }

  const { data: orders, error } = await window.GlowDB.client
    .from("orders")
    .select(`
      id,
      user_id,
      subtotal,
      discount,
      tax,
      total,
      status,
      created_at,
      order_items(
        id,
        product_id,
        quantity,
        unit_price,
        products(name, image_path)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar los pedidos:", error);
    adminOrders.innerHTML = `<p class="loaded-product-empty">No pudimos cargar los pedidos. Si acabas de sumar esta funcion, ejecuta el SQL nuevo en Supabase.</p>`;
    adminOrdersCount.textContent = "0 pedidos";
    if (adminOrdersTotal) adminOrdersTotal.textContent = "0 pedidos";
    if (adminOrdersPending) adminOrdersPending.textContent = "0 pendientes";
    if (adminOrdersRevenue) adminOrdersRevenue.textContent = formatDashboardMoney(0);
    return;
  }

  const userIds = [...new Set((orders || []).map(order => order.user_id).filter(Boolean))];
  let profilesById = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await window.GlowDB.client
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (!profilesError) {
      profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));
    } else {
      console.warn("No se pudieron cargar los nombres de clientes:", profilesError);
    }
  }

  loadedOrderCache = (orders || []).map(order => {
    const items = Array.isArray(order.order_items)
      ? order.order_items.map(item => ({
        id: item.id,
        name: item.products?.name || `Producto ${shortDashboardId(item.product_id)}`,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        image: productImage({ image_path: item.products?.image_path || "" })
      }))
      : [];

    return {
      ...order,
      status: String(order.status || "pendiente").toLowerCase(),
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      tax: Number(order.tax || 0),
      total: Number(order.total || 0),
      items,
      items_count: items.reduce((sum, item) => sum + item.quantity, 0),
      customer_name: order.user_id
        ? profilesById[order.user_id]?.full_name || `Cliente ${shortDashboardId(order.user_id)}`
        : "Invitado"
    };
  });

  const pendingOrders = loadedOrderCache.filter(order => order.status === "pendiente").length;
  const revenue = loadedOrderCache.reduce((sum, order) => sum + order.total, 0);

  adminOrdersCount.textContent = `${loadedOrderCache.length} pedido${loadedOrderCache.length === 1 ? "" : "s"}`;
  if (adminOrdersTotal) {
    adminOrdersTotal.textContent = `${loadedOrderCache.length} pedido${loadedOrderCache.length === 1 ? "" : "s"}`;
  }
  if (adminOrdersPending) {
    adminOrdersPending.textContent = `${pendingOrders} pendiente${pendingOrders === 1 ? "" : "s"}`;
  }
  if (adminOrdersRevenue) {
    adminOrdersRevenue.textContent = formatDashboardMoney(revenue);
  }

  adminOrders.innerHTML = loadedOrderCache.length
    ? loadedOrderCache.map(orderCardMarkup).join("")
    : `<p class="loaded-product-empty">Todavia no hay pedidos cargados.</p>`;
}

async function renderAnalytics() {
  if (!analyticsProducts || !window.GlowDB?.client) return;

  const [products, brands, categories] = await Promise.all([
    fetchAdminProducts(),
    window.GlowDB.listBrands(),
    window.GlowDB.listCategories()
  ]);

  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const inventoryValue = products.reduce((sum, product) => {
    return sum + Number(product.price || 0) * Number(product.stock || 0);
  }, 0);

  analyticsProducts.textContent = products.length;
  analyticsStock.textContent = totalStock;
  analyticsInventory.textContent = formatDashboardMoney(inventoryValue);
  analyticsBrands.textContent = brands.length;
  analyticsCategoriesCount.textContent = `${categories.length} categoria${categories.length === 1 ? "" : "s"}`;

  const categoryStats = categories.map(category => {
    const categoryProducts = products.filter(product => product.category_id === category.id);
    const stock = categoryProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0);

    return {
      name: category.name,
      products: categoryProducts.length,
      stock
    };
  });

  const maxCategoryStock = Math.max(...categoryStats.map(item => item.stock), 1);

  analyticsCategories.innerHTML = categoryStats.length
    ? categoryStats.map(item => {
      const barSize = Math.round((item.stock / maxCategoryStock) * 100);

      return `
        <article class="analytics-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${item.products} producto${item.products === 1 ? "" : "s"}</small>
          </div>
          <span>${item.stock} u.</span>
          <div class="analytics-bar" style="--bar-size: ${barSize}%">
            <span></span>
          </div>
        </article>
      `;
    }).join("")
    : `<p class="loaded-product-empty">Todavia no hay categorias cargadas.</p>`;

  const lowStockProducts = products
    .filter(product => Number(product.stock || 0) <= 5)
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));

  analyticsLowStock.innerHTML = lowStockProducts.length
    ? lowStockProducts.map(product => `
      <article class="analytics-row">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(product.categories?.name || "Sin categoria")}</small>
        </div>
        <span>${product.stock ?? 0} u.</span>
      </article>
    `).join("")
    : `<p class="loaded-product-empty">No hay productos con bajo stock.</p>`;
}

function syncDashboardNavigation(sectionId) {
  sectionLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.sectionLink === sectionId);
  });

  navGroups.forEach(group => {
    const hasActiveLink = Boolean(group.querySelector(`[data-section-link="${sectionId}"]`));
    group.classList.toggle("is-active", hasActiveLink);

    if (hasActiveLink) {
      group.classList.add("is-open");
    }

    const toggle = group.querySelector("[data-nav-group-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-expanded", group.classList.contains("is-open") ? "true" : "false");
    }
  });
}

function showDashboardSection(sectionId) {
  dashboardSections.forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  syncDashboardNavigation(sectionId);

  if (sectionId === "analiticas") {
    renderAnalytics();
  }

  if (sectionId === "empleados") {
    renderStaffMembers();
  }

  if (sectionId === "pedidos") {
    renderAdminOrders();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startProductEdit(productId) {
  const product = loadedProductCache.find(item => item.id === productId);
  if (!product) return;

  showDashboardSection("cargar-productos");
  productForm.dataset.editingId = product.id;
  productForm.dataset.currentImage = product.image_path || "";
  productForm.elements.name.value = product.name || "";
  productForm.elements.brand.value = product.brand_id || "";
  productForm.elements.category.value = product.category_id || "";
  productForm.elements.price.value = product.price ?? 0;
  productForm.elements.cost_price.value = product.cost_price ?? 0;
  productForm.elements.stock.value = product.stock ?? 0;
  productForm.elements.gradient_start.value = product.gradient_start || "#ff2da0";
  productForm.elements.gradient_end.value = product.gradient_end || "#7b2cff";
  productForm.elements.description.value = product.description || "";
  productImageInput.required = false;
  productSubmit.textContent = "Actualizar producto";
  cancelProductEdit.hidden = false;
  updateProductFinanceSummary();
  productForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateProductFinanceSummary() {
  if (!productForm || !productCostValue || !productProfitValue || !productProfitHint) return;

  const price = Number(productForm.elements.price?.value || 0);
  const cost = Number(productForm.elements.cost_price?.value || 0);
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  productCostValue.textContent = formatDashboardMoney(cost);
  productProfitValue.textContent = formatDashboardMoney(profit);
  productProfitValue.classList.toggle("is-negative", profit < 0);
  productProfitValue.classList.toggle("is-positive", profit >= 0);

  if (price <= 0 && cost <= 0) {
    productProfitHint.textContent = "Completa precio y costo para ver la diferencia.";
    return;
  }

  if (profit < 0) {
    productProfitHint.textContent = `Estas perdiendo ${formatDashboardMoney(Math.abs(profit))} por unidad.`;
    return;
  }

  productProfitHint.textContent = `Margen estimado sobre venta: ${margin.toFixed(1)}%.`;
}

function startStaffEdit(staffId) {
  if (!staffForm) return;

  const member = loadedStaffCache.find(item => item.id === staffId);
  if (!member) return;

  showDashboardSection("empleados");
  staffForm.dataset.editingId = member.id;
  staffForm.elements.full_name.value = member.full_name || "";
  staffForm.elements.role.value = member.role || "empleado";
  staffForm.elements.email.value = member.email || "";
  staffForm.elements.phone.value = member.phone || "";
  staffForm.elements.zone.value = member.zone || "";
  staffForm.elements.notes.value = member.notes || "";
  staffForm.elements.active.value = member.active ? "true" : "false";
  if (staffSubmit) {
    staffSubmit.textContent = "Actualizar personal";
  }
  if (cancelStaffEdit) {
    cancelStaffEdit.hidden = false;
  }
  staffForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function toggleFeaturedProduct(productId) {
  if (!window.GlowDB?.client) return;

  const product = loadedProductCache.find(item => item.id === productId);
  if (!product) return;

  const { error } = await window.GlowDB.client
    .from("products")
    .update({ is_featured: !product.is_featured })
    .eq("id", productId);

  if (error) {
    alert(`No se pudo actualizar el destacado: ${error.message}`);
    console.error(error);
    return;
  }

  await renderLoadedProducts();
  await renderAnalytics();
}

async function deleteProduct(productId) {
  if (!window.GlowDB?.client) return;

  const product = loadedProductCache.find(item => item.id === productId);
  const { error } = await window.GlowDB.client
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    alert(`No se pudo eliminar el producto: ${error.message}`);
    console.error(error);
    return;
  }

  if (product?.image_path) {
    await deleteDashboardImage(product.image_path);
  }

  if (productForm.dataset.editingId === productId) {
    resetProductForm();
  }

  await renderLoadedProducts();
  await renderAnalytics();
  alert("Producto eliminado.");
}

async function toggleStaffStatus(staffId) {
  if (!window.GlowDB?.client) return;

  const member = loadedStaffCache.find(item => item.id === staffId);
  if (!member) return;

  const { error } = await window.GlowDB.client
    .from("staff_members")
    .update({ active: !member.active })
    .eq("id", staffId);

  if (error) {
    alert(`No se pudo actualizar el estado: ${error.message}`);
    console.error(error);
    return;
  }

  await renderStaffMembers();
}

async function deleteStaffMember(staffId) {
  if (!window.GlowDB?.client) return;

  const { error } = await window.GlowDB.client
    .from("staff_members")
    .delete()
    .eq("id", staffId);

  if (error) {
    alert(`No se pudo eliminar la persona: ${error.message}`);
    console.error(error);
    return;
  }

  if (staffForm?.dataset.editingId === staffId) {
    resetStaffForm();
  }

  await renderStaffMembers();
  alert("Personal eliminado.");
}

async function updateOrderStatus(orderId, nextStatus) {
  if (!window.GlowDB?.client) return;

  const { error } = await window.GlowDB.client
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId);

  if (error) {
    alert(`No se pudo actualizar el pedido: ${error.message}`);
    console.error(error);
    return;
  }

  await renderAdminOrders();
}

menuButton.addEventListener("click", () => {
  dashboardShell.classList.toggle("sidebar-collapsed");
});

navGroupToggles.forEach(toggle => {
  toggle.addEventListener("click", () => {
    const group = toggle.closest(".nav-group");
    if (!group) return;

    const nextState = !group.classList.contains("is-open");
    group.classList.toggle("is-open", nextState);
    toggle.setAttribute("aria-expanded", nextState ? "true" : "false");
  });
});

brandForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    alert("Supabase no esta configurado.");
    return;
  }

  const formData = new FormData(brandForm);
  const logoFile = formData.get("logo");
  let logoPath = null;

  try {
    logoPath = await uploadDashboardImage(logoFile, "brands");
  } catch (error) {
    alert(`No se pudo subir el logo: ${error.message}`);
    console.error(error);
    return;
  }

  const { error } = await window.GlowDB.client
    .from("brands")
    .insert({
      name: formData.get("name"),
      logo_path: logoPath,
      active: true
    });

  if (error) {
    if (logoPath) {
      await deleteDashboardImage(logoPath);
    }

    alert(`No se pudo guardar la marca: ${error.message}`);
    console.error(error);
    return;
  }

  brandForm.reset();
  await loadDashboardOptions();
  await renderBrandsAndCategories();
  await renderAnalytics();
  alert("Marca guardada.");
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    alert("Supabase no esta configurado.");
    return;
  }

  const formData = new FormData(categoryForm);

  const { error } = await window.GlowDB.client
    .from("categories")
    .insert({
      name: formData.get("name"),
      active: true
    });

  if (error) {
    alert(`No se pudo guardar la categoria: ${error.message}`);
    console.error(error);
    return;
  }

  categoryForm.reset();
  await loadDashboardOptions();
  await renderBrandsAndCategories();
  await renderAnalytics();
  alert("Categoria guardada.");
});

staffForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    alert("Supabase no esta configurado.");
    return;
  }

  const formData = new FormData(staffForm);
  const editingId = staffForm.dataset.editingId;
  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    role: formData.get("role") || "empleado",
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    zone: String(formData.get("zone") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    active: formData.get("active") === "true"
  };

  const request = editingId
    ? window.GlowDB.client.from("staff_members").update(payload).eq("id", editingId)
    : window.GlowDB.client.from("staff_members").insert(payload);

  const { error } = await request;

  if (error) {
    alert(`No se pudo ${editingId ? "actualizar" : "guardar"} el personal: ${error.message}`);
    console.error(error);
    return;
  }

  resetStaffForm();
  await renderStaffMembers();
  alert(editingId ? "Personal actualizado." : "Personal guardado.");
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    alert("Supabase no esta configurado.");
    return;
  }

  const formData = new FormData(productForm);
  const imageFile = formData.get("image");
  const editingId = productForm.dataset.editingId;
  const previousImagePath = productForm.dataset.currentImage || null;
  let imagePath = previousImagePath;
  let uploadedImagePath = null;

  if (!editingId && (!imageFile || imageFile.size === 0)) {
    alert("Para guardar un producto tenes que cargar una imagen.");
    return;
  }

  if (imageFile && imageFile.size > 0) {
    try {
      uploadedImagePath = await uploadDashboardImage(imageFile, "products");
      imagePath = uploadedImagePath;
    } catch (error) {
      alert(`No se pudo subir la imagen: ${error.message}`);
      console.error(error);
      return;
    }
  }

  const payload = {
    name: formData.get("name"),
    brand_id: formData.get("brand") || null,
    category_id: formData.get("category") || null,
    description: formData.get("description"),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    image_path: imagePath,
    gradient_start: formData.get("gradient_start") || "#ff2da0",
    gradient_end: formData.get("gradient_end") || "#7b2cff",
    active: true
  };

  const request = editingId
    ? window.GlowDB.client.from("products").update(payload).eq("id", editingId).select("id").single()
    : window.GlowDB.client.from("products").insert(payload).select("id").single();

  const { data: savedProduct, error } = await request;

  if (error) {
    if (uploadedImagePath) {
      await deleteDashboardImage(uploadedImagePath);
    }

    alert(`No se pudo ${editingId ? "actualizar" : "guardar"} el producto: ${error.message}`);
    console.error(error);
    return;
  }

  const financialPayload = {
    product_id: savedProduct.id,
    cost_price: Number(formData.get("cost_price") || 0)
  };

  const { error: financialError } = await window.GlowDB.client
    .from("product_financials")
    .upsert(financialPayload, { onConflict: "product_id" });

  if (financialError) {
    alert(`El producto se guardo, pero no pudimos guardar el costo privado: ${financialError.message}`);
    console.error(financialError);
  }

  if (editingId && uploadedImagePath && previousImagePath && previousImagePath !== uploadedImagePath) {
    await deleteDashboardImage(previousImagePath);
  }

  resetProductForm();
  await renderLoadedProducts();
  await renderAnalytics();
  alert(editingId ? "Producto actualizado." : "Producto guardado.");
});

productForm.elements.price?.addEventListener("input", updateProductFinanceSummary);
productForm.elements.cost_price?.addEventListener("input", updateProductFinanceSummary);

loadedProducts.addEventListener("click", async (event) => {
  const featuredButton = event.target.closest(".toggle-featured");
  if (featuredButton) {
    await toggleFeaturedProduct(featuredButton.dataset.id);
    return;
  }

  const editButton = event.target.closest(".edit-product");
  if (editButton) {
    startProductEdit(editButton.dataset.id);
    return;
  }

  const button = event.target.closest(".delete-product");
  if (!button || !window.GlowDB?.client) return;

  const productId = button.dataset.id;
  const shouldDelete = confirm("Seguro que queres eliminar este producto del catalogo?");
  if (!shouldDelete) return;

  await deleteProduct(productId);
});

featuredProducts.addEventListener("click", async (event) => {
  const featuredButton = event.target.closest(".toggle-featured");
  if (featuredButton) {
    await toggleFeaturedProduct(featuredButton.dataset.id);
    return;
  }

  const editButton = event.target.closest(".edit-product");
  if (editButton) {
    startProductEdit(editButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest(".delete-product");
  if (!deleteButton || !window.GlowDB?.client) return;

  const shouldDelete = confirm("Seguro que queres eliminar este producto del catalogo?");
  if (!shouldDelete) return;

  await deleteProduct(deleteButton.dataset.id);
});

cancelProductEdit.addEventListener("click", resetProductForm);
cancelStaffEdit?.addEventListener("click", resetStaffForm);

logoutButton?.addEventListener("click", async (event) => {
  event.preventDefault();

  if (window.GlowDB?.client) {
    await window.GlowDB.client.auth.signOut();
  }

  window.location.href = "auth.html";
});

loadedBrands.addEventListener("click", async (event) => {
  const orderButton = event.target.closest(".order-brand");
  if (orderButton) {
    await moveBrand(orderButton.dataset.id, Number(orderButton.dataset.direction));
    return;
  }

  const button = event.target.closest(".delete-brand");
  if (!button || !window.GlowDB?.client) return;

  const brand = loadedBrandCache.find(item => item.id === button.dataset.id);
  const shouldDelete = confirm("Seguro que queres eliminar esta marca?");
  if (!shouldDelete) return;

  const { error } = await window.GlowDB.client
    .from("brands")
    .delete()
    .eq("id", button.dataset.id);

  if (error) {
    alert(`No se pudo eliminar la marca: ${error.message}`);
    console.error(error);
    return;
  }

  if (brand?.logo_path) {
    await deleteDashboardImage(brand.logo_path);
  }

  await loadDashboardOptions();
  await renderBrandsAndCategories();
  await renderLoadedProducts();
  await renderAnalytics();
});

loadedCategories.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-category");
  if (!button || !window.GlowDB?.client) return;

  const shouldDelete = confirm("Seguro que queres eliminar esta categoria?");
  if (!shouldDelete) return;

  const { error } = await window.GlowDB.client
    .from("categories")
    .delete()
    .eq("id", button.dataset.id);

  if (error) {
    alert(`No se pudo eliminar la categoria: ${error.message}`);
    console.error(error);
    return;
  }

  await loadDashboardOptions();
  await renderBrandsAndCategories();
  await renderLoadedProducts();
  await renderAnalytics();
});

staffMembers?.addEventListener("click", async (event) => {
  const editButton = event.target.closest(".edit-staff");
  if (editButton) {
    startStaffEdit(editButton.dataset.id);
    return;
  }

  const toggleButton = event.target.closest(".toggle-staff");
  if (toggleButton) {
    await toggleStaffStatus(toggleButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest(".delete-staff");
  if (!deleteButton) return;

  const shouldDelete = confirm("Seguro que queres eliminar este perfil del equipo?");
  if (!shouldDelete) return;

  await deleteStaffMember(deleteButton.dataset.id);
});

adminOrders?.addEventListener("change", async (event) => {
  const select = event.target.closest(".order-status-select");
  if (!select) return;

  await updateOrderStatus(select.dataset.id, select.value);
});

sectionLinks.forEach(link => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showDashboardSection(link.dataset.sectionLink);
  });
});

async function initDashboard() {
  const canContinue = await requireDashboardSession();
  if (!canContinue) return;

  await loadDashboardOptions();
  await renderBrandsAndCategories();
  await renderLoadedProducts();
  await renderStaffMembers();
  await renderAdminOrders();
  await renderAnalytics();
  showDashboardSection("cargar-productos");
  resetProductForm();
  resetStaffForm();
}

initDashboard();
