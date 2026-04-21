// Espera a que cargue TODO
window.addEventListener("DOMContentLoaded", () => {

  console.log("JS OK 🔥");

  // =====================
  // ICONOS
  // =====================
  const preloader = document.getElementById("preloader");
  const minimumPreloadTime = 1400;
  const preloadStartedAt = Date.now();
  let preloaderClosed = false;

  function closePreloader() {
    if (preloaderClosed || !preloader) return;
    preloaderClosed = true;
    preloader.classList.add("is-hidden");
    document.body.classList.remove("is-preloading");

    window.setTimeout(() => {
      preloader.remove();
    }, 760);
  }

  function schedulePreloaderClose() {
    const remaining = Math.max(0, minimumPreloadTime - (Date.now() - preloadStartedAt));
    window.setTimeout(closePreloader, remaining);
  }

  if (document.readyState === "complete") {
    schedulePreloaderClose();
  } else {
    window.addEventListener("load", schedulePreloaderClose, { once: true });
    window.setTimeout(schedulePreloaderClose, 2600);
  }

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // =====================
  // NAVBAR PILL
  // =====================
  const nav = document.querySelector(".nav");
  const links = document.querySelectorAll(".nav > a, .nav-item > a");
  const pill = document.querySelector(".pill");

  function movePill(el) {
    if (!el || !pill || !nav) return;

    const rect = el.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    pill.style.width = rect.width + "px";
    pill.style.left = rect.left - navRect.left + "px";
  }

  links.forEach(link => {
    link.addEventListener("click", () => {
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      movePill(link);
    });
  });

  movePill(document.querySelector(".nav a.active"));
  window.addEventListener("resize", () => {
    movePill(document.querySelector(".nav a.active"));
    if (products.length) {
      updateTagText(products[index].tag);
    }
  });



  // =====================
  // SLIDER
  // =====================
  let products = [
    {
      title: "Cleaner<br><span>Strong 600ML</span>",
      desc: "Limpiador multipropósito para motores y suciedad difícil.",
      price: "$11.999",
      img: "assets/img/producto3.png",
      tag: "LIMPIADOR",
      brand: "Glow Boxes",
      gradientStart: "#ff2da0",
      gradientEnd: "#7b2cff"
    },
    {
      title: "Foam<br><span>Banana 500ML</span>",
      desc: "Shampoo espumante con aroma banana.",
      price: "$13.500",
      img: "assets/img/producto1.png",
      tag: "SHAMPOO",
      brand: "Glow Boxes",
      gradientStart: "#ff2da0",
      gradientEnd: "#7b2cff"
    },
    {
      title: "Foam<br><span>Naranja 500ML</span>",
      desc: "Shampoo espumante con aroma naranja.",
      price: "$9.999",
      img: "assets/img/producto2.png",
      tag: "SHAMPOO",
      brand: "Glow Boxes",
      gradientStart: "#ff2da0",
      gradientEnd: "#7b2cff"
    }
  ];

  let allProducts = [...products];
  let index = 0;

  const title = document.getElementById("title");
  const desc = document.getElementById("desc");
  const price = document.getElementById("price");
  const img = document.getElementById("productImg");
  const previewImg = document.getElementById("previewImg");
  const nextPreviewImg = document.getElementById("nextPreviewImg");
  const productStage = document.getElementById("productStage");
  const tag = document.getElementById("tag");

  const current = document.getElementById("current");
  const total = document.getElementById("total");

  const next = document.getElementById("next");
  const prev = document.getElementById("prev");
  const showAllProducts = document.querySelector("[data-show-all-products]");
  const brandsDropdown = document.getElementById("brandsDropdown");
  const brandsNavLink = document.getElementById("brandsNavLink");

  let isSliding = false;
  const textSwapDelay = 220;
  const productAnimationTime = 860;

  function stripTitleHtml(value) {
    return value.replace(/<[^>]+>/g, " ");
  }

  function formatProductPrice(value) {
    const number = Number(value || 0);
    return `$${number.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  function formatProductTitle(name) {
    const words = String(name || "Producto").trim().split(/\s+/).filter(Boolean);

    if (words.length <= 1) {
      return `${words[0] || "Producto"}<br><span></span>`;
    }

    const firstLine = words.length >= 4 ? words.slice(0, 2).join(" ") : words[0];
    const secondLine = words.length >= 4 ? words.slice(2).join(" ") : words.slice(1).join(" ");

    return `${firstLine}<br><span>${secondLine}</span>`;
  }

  function normalizeAssetPath(path) {
    return String(path || "").replace(/^img\//, "assets/img/");
  }

  function mapDbProduct(product) {
    const category = product.categories?.name || product.brands?.name || "PRODUCTO";

    return {
      id: product.id,
      title: formatProductTitle(product.name),
      desc: product.description || "Producto disponible en Glow Boxes.",
      price: formatProductPrice(product.price),
      img: normalizeAssetPath(product.image_path) || "assets/img/logo.png",
      tag: category.toUpperCase(),
      brand: product.brands?.name || "",
      gradientStart: product.gradient_start || "#ff2da0",
      gradientEnd: product.gradient_end || "#7b2cff"
    };
  }

  function updatePageGradient(product) {
    document.body.style.setProperty("--hero-gradient-start", product.gradientStart || "#ff2da0");
    document.body.style.setProperty("--hero-gradient-end", product.gradientEnd || "#7b2cff");
  }

  function getTagWidth(value) {
    const clone = tag.cloneNode(false);
    const parentWidth = tag.parentElement?.getBoundingClientRect().width || 240;
    const maxWidth = Math.min(window.innerWidth <= 900 ? parentWidth : 230, parentWidth);

    clone.removeAttribute("style");
    clone.textContent = value;
    clone.classList.add("is-measuring");
    document.body.appendChild(clone);

    const measuredWidth = Math.ceil(clone.getBoundingClientRect().width);
    clone.remove();

    return Math.max(92, Math.min(measuredWidth, maxWidth));
  }

  function updateTagText(value, animated = false) {
    if (tag.textContent === value && tag.style.width) return;

    const nextWidth = getTagWidth(value);

    if (!animated) {
      tag.textContent = value;
      tag.style.width = `${nextWidth}px`;
      return;
    }

    const currentWidth = tag.offsetWidth;
    tag.style.width = `${currentWidth}px`;
    tag.style.opacity = "0.62";
    tag.offsetHeight;

    requestAnimationFrame(() => {
      tag.textContent = value;
      tag.style.width = `${nextWidth}px`;
      tag.style.opacity = "1";
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function setProductCollection(nextProducts, emptyMessage) {
    if (!nextProducts.length) {
      alert(emptyMessage || "No hay productos para mostrar.");
      return;
    }

    products = nextProducts;
    index = 0;
    updateSliderTotal();
    updateCopy();
  }

  function setActiveNavLink(link) {
    if (!link) return;

    links.forEach(item => item.classList.remove("active"));
    link.classList.add("active");
    movePill(link);
  }

  function renderBrandDropdown(brands) {
    if (!brandsDropdown || !brands?.length) return;

    brandsDropdown.innerHTML = brands
      .map(brand => {
        const name = String(brand.name || "").trim();
        return `<a data-brand-filter="${name}">${name.toUpperCase()}</a>`;
      })
      .join("");
  }

  function updateSliderTotal() {
    total.textContent = String(products.length).padStart(2, "0");
  }

  function updateCounter(direction = 1, animated = false) {
    const nextValue = String(index + 1).padStart(2, "0");

    if (!animated) {
      current.textContent = nextValue;
      return;
    }

    const animationClass = direction > 0 ? "count-up" : "count-down";
    current.classList.remove("count-up", "count-down");
    current.offsetHeight;
    current.textContent = nextValue;
    current.classList.add(animationClass);
  }

  async function loadProductsFromSupabase() {
    if (!window.GlowDB?.isConfigured) {
      updateSliderTotal();
      updateCopy();
      return;
    }

    const [dbProducts, featuredProducts, dbBrands] = await Promise.all([
      window.GlowDB.listProducts(),
      window.GlowDB.listFeaturedProducts ? window.GlowDB.listFeaturedProducts() : [],
      window.GlowDB.listBrands ? window.GlowDB.listBrands() : []
    ]);

    if (dbBrands.length > 0) {
      renderBrandDropdown(dbBrands);
    }

    if (dbProducts.length > 0) {
      allProducts = dbProducts.map(mapDbProduct);
      products = featuredProducts.length > 0
        ? featuredProducts.map(mapDbProduct)
        : allProducts;
      index = 0;
    }

    updateSliderTotal();
    updateCopy();
  }

  function getPreviewIndex(direction = 1) {
    if (!products.length) return 0;
    return (index + direction + products.length) % products.length;
  }

  function updateCopy() {
    if (!products.length) return;

    const p = products[index];

    title.innerHTML = p.title;
    desc.textContent = p.desc;
    price.textContent = p.price;
    img.src = p.img;
    updateTagText(p.tag);
    updatePageGradient(p);
    updateCounter(1);
    previewImg.src = products[getPreviewIndex(1)].img;
    nextPreviewImg.src = products[getPreviewIndex(2)].img;
    updateWishlistButton();
  }

  function updateSlide(direction = 1) {
    if (isSliding || !products.length) return;

    isSliding = true;
    const p = products[index];
    const upcomingPreview = products[getPreviewIndex(1)].img;
    const titleOutClass = direction > 0 ? "slide-out-title" : "slide-out-title-down";
    const titleInClass = direction > 0 ? "slide-up-title" : "slide-down-title";
    const descOutClass = direction > 0 ? "slide-out-desc" : "slide-out-desc-down";
    const descInClass = direction > 0 ? "slide-up-desc" : "slide-down-desc";
    const priceOutClass = direction > 0 ? "slide-out-price" : "slide-out-price-down";
    const priceInClass = direction > 0 ? "slide-up-price" : "slide-down-price";

    title.classList.remove("slide-up-title", "slide-down-title", "slide-out-title", "slide-out-title-down");
    desc.classList.remove("slide-up-desc", "slide-down-desc", "slide-out-desc", "slide-out-desc-down");
    price.classList.remove("slide-up-price", "slide-down-price", "slide-out-price", "slide-out-price-down");
    title.classList.add(titleOutClass);
    desc.classList.add(descOutClass);
    price.classList.add(priceOutClass);
    previewImg.src = p.img;
    nextPreviewImg.src = upcomingPreview;
    previewImg.classList.toggle("from-left", direction < 0);
    productStage.classList.remove("next", "prev", "is-resetting");
    productStage.offsetHeight;
    productStage.classList.add(direction > 0 ? "next" : "prev");

    setTimeout(() => {

      title.innerHTML = p.title;
      desc.textContent = p.desc;
      price.textContent = p.price;
      updateTagText(p.tag, true);
      updatePageGradient(p);
      updateCounter(direction, true);
      updateWishlistButton();

      title.classList.remove(titleOutClass);
      desc.classList.remove(descOutClass);
      price.classList.remove(priceOutClass);

      title.offsetHeight;
      title.classList.add(titleInClass);
      desc.offsetHeight;
      desc.classList.add(descInClass);
      price.offsetHeight;
      price.classList.add(priceInClass);

    }, textSwapDelay);

    setTimeout(() => {

      productStage.classList.add("is-resetting");

      img.src = p.img;
      previewImg.src = upcomingPreview;
      nextPreviewImg.src = products[getPreviewIndex(2)].img;
      previewImg.classList.remove("from-left");
      productStage.classList.remove("next", "prev");
      productStage.offsetHeight;

      requestAnimationFrame(() => {
        productStage.classList.remove("is-resetting");
      });

      isSliding = false;

    }, productAnimationTime);
  }

  next.addEventListener("click", () => {
    if (!products.length) return;
    index = (index + 1) % products.length;
    updateSlide(1);
  });

  prev.addEventListener("click", () => {
    if (!products.length) return;
    index = (index - 1 + products.length) % products.length;
    updateSlide(-1);
  });

  showAllProducts.addEventListener("click", () => {
    setActiveNavLink(showAllProducts);
    setProductCollection(allProducts, "Todavia no hay productos cargados.");
  });

  brandsDropdown?.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-brand-filter]");
    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    const brandName = link.dataset.brandFilter;
    let filteredProducts = allProducts.filter(product => {
      return normalizeText(product.brand) === normalizeText(brandName);
    });

    if (window.GlowDB?.isConfigured && window.GlowDB.listProductsByBrandName) {
      const dbProducts = await window.GlowDB.listProductsByBrandName(brandName);
      filteredProducts = dbProducts.map(mapDbProduct);
    }

    setActiveNavLink(brandsNavLink);
    setProductCollection(filteredProducts, `Todavia no hay productos cargados de ${brandName}.`);
    window.location.hash = "inicio";
  });

  // =====================
  // 🛒 CARRITO PRO (FIXED)
  // =====================
  const cartIcon = document.querySelector(".cart");
  const cartDropdown = document.getElementById("cartDropdown");
  const cartItemsContainer = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const addToWishlist = document.getElementById("addToWishlist");
  const wishlistCount = document.getElementById("wishlistCount");

  const btn = document.getElementById("addToCart");
  const dot = document.getElementById("cartCount");

  let cart = [];
  let wishlist = [];

  function currentProductName() {
    return title.innerText.trim();
  }

  function updateWishlistButton() {
    if (!addToWishlist) return;
    addToWishlist.classList.toggle("active", wishlist.includes(currentProductName()));
  }

  function renderWishlistCount() {
    wishlistCount.textContent = wishlist.length;
    wishlistCount.style.opacity = wishlist.length > 0 ? "1" : "0";
    wishlistCount.style.transform = wishlist.length > 0 ? "scale(1)" : "scale(0)";
  }

  addToWishlist.addEventListener("click", () => {
    const name = currentProductName();

    if (!wishlist.includes(name)) {
      wishlist.push(name);
    } else {
      wishlist = wishlist.filter(item => item !== name);
    }

    renderWishlistCount();
    updateWishlistButton();
  });

  renderWishlistCount();
  loadProductsFromSupabase();

  function animateAddToCart() {
    btn.classList.remove("added");
    dot.classList.remove("cart-bump");
    btn.offsetHeight;
    dot.offsetHeight;
    btn.classList.add("added");
    dot.classList.add("cart-bump");
  }

  // abrir carrito desde icono
  cartIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    cartDropdown.classList.toggle("active");
  });

  // cerrar si clickeás afuera
  document.addEventListener("click", () => {
    cartDropdown.classList.remove("active");
  });

  // evitar cierre si tocás dentro
  cartDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // agregar producto
  btn.addEventListener("click", () => {

    const product = {
      name: title.innerText,
      price: price.innerText
    };

    cart.push(product);

    dot.textContent = cart.length;
    dot.style.opacity = "1";
    dot.style.transform = "scale(1)";

    renderCart();
    animateAddToCart();
  });

  function renderCart() {

    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `<p class="empty">Tu carrito está vacío</p>`;
      cartTotal.textContent = "0";
      return;
    }

    let total = 0;

    cart.forEach((item, i) => {

      const priceNumber = parseInt(item.price.replace(/\D/g, ""));
      total += priceNumber;

      const div = document.createElement("div");
      div.classList.add("cart-item");

      div.innerHTML = `
        <span>${item.name}</span>
        <span>${item.price}</span>
        <button class="remove" data-index="${i}">✕</button>
      `;

      cartItemsContainer.appendChild(div);
    });

    cartTotal.textContent = total.toLocaleString();

    // eliminar item
    document.querySelectorAll(".remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = e.target.dataset.index;
        cart.splice(index, 1);

        dot.textContent = cart.length;
        if (cart.length === 0) {
          dot.style.opacity = "0";
          dot.style.transform = "scale(0)";
        }

        renderCart();
      });
    });
  }

  const checkoutOrder = document.getElementById("checkoutOrder");

  checkoutOrder.addEventListener("click", () => {
    if (checkoutOrder.classList.contains("animate")) return;

    checkoutOrder.classList.add("animate");

    setTimeout(() => {
      checkoutOrder.classList.remove("animate");
    }, 10000);
  });



  // =====================
  // 🔍 SEARCH
  // =====================
  const searchBox = document.getElementById("searchBox");
  const searchInput = document.getElementById("searchInput");

  searchBox.addEventListener("click", (e) => {
    searchBox.classList.add("active");
    searchInput.focus();
    movePill(document.querySelector(".nav a.active"));
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    searchBox.classList.remove("active");
    movePill(document.querySelector(".nav a.active"));
  });

  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();

    const foundIndex = products.findIndex(p =>
      stripTitleHtml(p.title).toLowerCase().includes(value) ||
      p.desc.toLowerCase().includes(value)
    );

    if (foundIndex !== -1) {
      index = foundIndex;
      updateSlide();
    }
  });

});
