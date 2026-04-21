const dashboardShell = document.querySelector(".dashboard-shell");
const menuButton = document.querySelector(".menu-button");
const productForm = document.getElementById("productForm");
const brandForm = document.getElementById("brandForm");
const categoryForm = document.getElementById("categoryForm");
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
const productImageInput = document.getElementById("productImageInput");
const logoutButton = document.getElementById("logoutButton");
const dashboardUserName = document.getElementById("dashboardUserName");
const dashboardUserRole = document.getElementById("dashboardUserRole");
const sectionLinks = document.querySelectorAll("[data-section-link]");
const dashboardSections = document.querySelectorAll(".dashboard-section");
const analyticsProducts = document.getElementById("analyticsProducts");
const analyticsStock = document.getElementById("analyticsStock");
const analyticsInventory = document.getElementById("analyticsInventory");
const analyticsBrands = document.getElementById("analyticsBrands");
const analyticsCategoriesCount = document.getElementById("analyticsCategoriesCount");
const analyticsCategories = document.getElementById("analyticsCategories");
const analyticsLowStock = document.getElementById("analyticsLowStock");
let loadedProductCache = [];
let loadedBrandCache = [];
let loadedCategoryCache = [];

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

  return true;
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

function productImage(product) {
  return String(product.image_path || "assets/img/logo.png").replace(/^img\//, "assets/img/");
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

  const products = await window.GlowDB.listProducts();
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

async function renderAnalytics() {
  if (!analyticsProducts || !window.GlowDB?.client) return;

  const [products, brands, categories] = await Promise.all([
    window.GlowDB.listProducts(),
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

function showDashboardSection(sectionId) {
  dashboardSections.forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  sectionLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.sectionLink === sectionId);
  });

  if (sectionId === "analiticas") {
    renderAnalytics();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startProductEdit(productId) {
  const product = loadedProductCache.find(item => item.id === productId);
  if (!product) return;

  productForm.dataset.editingId = product.id;
  productForm.dataset.currentImage = product.image_path || "";
  productForm.elements.name.value = product.name || "";
  productForm.elements.brand.value = product.brand_id || "";
  productForm.elements.category.value = product.category_id || "";
  productForm.elements.price.value = product.price ?? 0;
  productForm.elements.stock.value = product.stock ?? 0;
  productForm.elements.gradient_start.value = product.gradient_start || "#ff2da0";
  productForm.elements.gradient_end.value = product.gradient_end || "#7b2cff";
  productForm.elements.description.value = product.description || "";
  productImageInput.required = false;
  productSubmit.textContent = "Actualizar producto";
  cancelProductEdit.hidden = false;
  productForm.scrollIntoView({ behavior: "smooth", block: "center" });
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

menuButton.addEventListener("click", () => {
  dashboardShell.classList.toggle("sidebar-collapsed");
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

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    alert("Supabase no esta configurado.");
    return;
  }

  const formData = new FormData(productForm);
  const imageFile = formData.get("image");
  const editingId = productForm.dataset.editingId;
  let imagePath = productForm.dataset.currentImage || null;

  if (!editingId && (!imageFile || imageFile.size === 0)) {
    alert("Para guardar un producto tenes que cargar una imagen.");
    return;
  }

  if (imageFile && imageFile.size > 0) {
    try {
      imagePath = await uploadDashboardImage(imageFile, "products");
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
    ? window.GlowDB.client.from("products").update(payload).eq("id", editingId)
    : window.GlowDB.client.from("products").insert(payload);

  const { error } = await request;

  if (error) {
    alert(`No se pudo ${editingId ? "actualizar" : "guardar"} el producto: ${error.message}`);
    console.error(error);
    return;
  }

  resetProductForm();
  await renderLoadedProducts();
  await renderAnalytics();
  alert(editingId ? "Producto actualizado." : "Producto guardado.");
});

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

  const { error } = await window.GlowDB.client
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    alert(`No se pudo eliminar el producto: ${error.message}`);
    console.error(error);
    return;
  }

  await renderLoadedProducts();
  await renderAnalytics();
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

  const { error } = await window.GlowDB.client
    .from("products")
    .delete()
    .eq("id", deleteButton.dataset.id);

  if (error) {
    alert(`No se pudo eliminar el producto: ${error.message}`);
    console.error(error);
    return;
  }

  await renderLoadedProducts();
  await renderAnalytics();
});

cancelProductEdit.addEventListener("click", resetProductForm);

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

sectionLinks.forEach(link => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showDashboardSection(link.dataset.sectionLink);
  });
});

async function initDashboard() {
  const canContinue = await requireDashboardSession();
  if (!canContinue) return;

  loadDashboardOptions();
  renderBrandsAndCategories();
  renderLoadedProducts();
  renderAnalytics();
  resetProductForm();
}

initDashboard();
