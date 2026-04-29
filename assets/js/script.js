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
      id: "local-cleaner-strong-600ml",
      name: "Cleaner Strong 600ML",
      title: "Cleaner<br><span>Strong 600ML</span>",
      desc: "Limpiador multipropósito para motores y suciedad difícil.",
      price: "$11.999",
      priceValue: 11999,
      img: "assets/img/producto3.png",
      modelPath: "",
      tag: "LIMPIADOR",
      brand: "Glow Boxes",
      gradientStart: "#ff2da0",
      gradientEnd: "#7b2cff"
    },
    {
      id: "local-foam-banana-500ml",
      name: "Foam Banana 500ML",
      title: "Foam<br><span>Banana 500ML</span>",
      desc: "Shampoo espumante con aroma banana.",
      price: "$13.500",
      priceValue: 13500,
      img: "assets/img/producto1.png",
      modelPath: "",
      tag: "SHAMPOO",
      brand: "Glow Boxes",
      gradientStart: "#ff2da0",
      gradientEnd: "#7b2cff"
    },
    {
      id: "local-foam-naranja-500ml",
      name: "Foam Naranja 500ML",
      title: "Foam<br><span>Naranja 500ML</span>",
      desc: "Shampoo espumante con aroma naranja.",
      price: "$9.999",
      priceValue: 9999,
      img: "assets/img/producto2.png",
      modelPath: "",
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
  const productThreeViewer = document.getElementById("productThreeViewer");
  const tag = document.getElementById("tag");

  const current = document.getElementById("current");
  const total = document.getElementById("total");

  const next = document.getElementById("next");
  const prev = document.getElementById("prev");
  const showAllProducts = document.querySelector("[data-show-all-products]");
  const brandsDropdown = document.getElementById("brandsDropdown");
  const brandsNavLink = document.getElementById("brandsNavLink");
  const brandsTrack = document.getElementById("brandsTrack");

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
    const value = String(path || "").trim();

    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;

    return value.replace(/^img\//, "assets/img/");
  }

  function mapDbProduct(product) {
    const category = product.categories?.name || product.brands?.name || "PRODUCTO";

    return {
      id: product.id,
      name: product.name,
      title: formatProductTitle(product.name),
      desc: product.description || "Producto disponible en Glow Boxes.",
      price: formatProductPrice(product.price),
      priceValue: Number(product.price || 0),
      img: normalizeAssetPath(product.image_path) || "assets/img/logo.png",
      modelPath: normalizeAssetPath(product.model_path),
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

  function createProductThreeViewer(container) {
    if (!container || typeof THREE === "undefined") {
      return null;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const loader = typeof THREE.GLTFLoader !== "undefined" ? new THREE.GLTFLoader() : null;
    const group = new THREE.Group();
    const clock = new THREE.Clock();
    const pointer = { active: false, x: 0, rotation: 0 };

    let activeModel = null;
    let rafId = null;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    camera.position.set(0, 0.12, 6.4);
    scene.add(group);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x332266, 1.34);
    const key = new THREE.DirectionalLight(0xffffff, 2.25);
    const rim = new THREE.DirectionalLight(0xffe9ff, 1.42);
    key.position.set(3.6, 4.2, 5.2);
    rim.position.set(-4.5, 2.2, -2.8);
    scene.add(ambient, key, rim);

    function resize() {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function disposeMaterial(material) {
      Object.keys(material).forEach(key => {
        const value = material[key];
        if (value?.isTexture) {
          value.dispose();
        }
      });
      material.dispose();
    }

    function clearModel() {
      if (!activeModel) return;

      group.remove(activeModel);
      activeModel.traverse?.(child => {
        child.geometry?.dispose();

        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(disposeMaterial);
        }
      });
      activeModel = null;
    }

    function createMaterial(color, roughness = 0.42, metalness = 0.08) {
      return new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }

    function createLabelTexture(product) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const start = product.gradientStart || "#ff2da0";
      const end = product.gradientEnd || "#7b2cff";
      canvas.width = 768;
      canvas.height = 512;

      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, start);
      gradient.addColorStop(1, end);
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "rgba(255,255,255,0.93)";
      if (typeof context.roundRect === "function") {
        context.beginPath();
        context.roundRect(46, 46, 676, 420, 34);
        context.fill();
      } else {
        context.fillRect(46, 46, 676, 420);
      }

      context.fillStyle = "#1d1730";
      context.textAlign = "center";
      context.font = "800 58px Urbanist, Arial, sans-serif";
      context.fillText(product.name || "Glow Boxes", 384, 168, 620);
      context.font = "700 34px Urbanist, Arial, sans-serif";
      context.fillStyle = "#ff2da0";
      context.fillText(product.tag || "PRODUCTO", 384, 228, 620);
      context.font = "800 72px Urbanist, Arial, sans-serif";
      context.fillStyle = "#1d1730";
      context.fillText("GLOW", 384, 336, 620);
      context.font = "700 34px Urbanist, Arial, sans-serif";
      context.fillText("BOXES", 384, 386, 620);

      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function createProceduralProduct(product) {
      const root = new THREE.Group();
      const bodyMaterial = createMaterial(product.gradientStart || "#ff2da0", 0.36, 0.12);
      const capMaterial = createMaterial(product.gradientEnd || "#7b2cff", 0.28, 0.18);
      const darkMaterial = createMaterial(0x17111f, 0.46, 0.18);
      const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.18,
        transparent: true,
        opacity: 0.2
      });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.88, 3.15, 56), bodyMaterial);
      const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.82, 0.42, 56), capMaterial);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.54, 40), bodyMaterial);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.42, 40), darkMaterial);
      const gloss = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.91, 3.2, 56, 1, true), glassMaterial);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.34, 1.52),
        new THREE.MeshStandardMaterial({
          map: createLabelTexture(product),
          roughness: 0.32,
          metalness: 0.03,
          transparent: true
        })
      );
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.2, 56),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
      );

      body.position.y = -0.12;
      shoulder.position.y = 1.66;
      neck.position.y = 2.08;
      cap.position.y = 2.55;
      gloss.position.y = -0.12;
      label.position.set(0, -0.2, 0.895);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.86;

      root.add(body, shoulder, neck, cap, gloss, label, shadow);
      root.scale.setScalar(1.05);
      return root;
    }

    function frameModel(model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      model.position.sub(center);

      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(3.9 / maxAxis);
      model.rotation.y = -0.24;
    }

    function setModel(model) {
      clearModel();
      activeModel = model;
      group.add(activeModel);
      frameModel(activeModel);
      container.classList.add("is-ready");
    }

    function setProduct(product) {
      if (!product) return;

      container.classList.remove("is-ready");
      window.setTimeout(() => {
        if (product.modelPath && loader) {
          loader.load(product.modelPath, gltf => setModel(gltf.scene), undefined, () => {
            setModel(createProceduralProduct(product));
          });
          return;
        }

        setModel(createProceduralProduct(product));
      }, 120);
    }

    function animate() {
      const elapsed = clock.getElapsedTime();
      if (activeModel) {
        activeModel.rotation.y += 0.006;
        activeModel.rotation.x = Math.sin(elapsed * 0.74) * 0.035;
        activeModel.position.y = Math.sin(elapsed * 1.15) * 0.06;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }

    container.addEventListener("pointerdown", event => {
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.rotation = activeModel?.rotation.y || 0;
      container.setPointerCapture?.(event.pointerId);
    });

    container.addEventListener("pointermove", event => {
      if (!pointer.active || !activeModel) return;
      const delta = (event.clientX - pointer.x) / Math.max(1, container.offsetWidth);
      activeModel.rotation.y = pointer.rotation + delta * Math.PI * 2;
    });

    window.addEventListener("pointerup", () => {
      pointer.active = false;
    });

    resize();
    window.addEventListener("resize", resize);
    animate();

    return { setProduct };
  }

  const product3d = createProductThreeViewer(productThreeViewer);
  if (product3d && productStage) {
    productStage.classList.add("is-three-active");
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function buildBrandsLoop(brands) {
    const normalizedBrands = brands
      .map(brand => ({
        name: String(brand?.name || "").trim(),
        logo: normalizeAssetPath(brand?.logo_path)
      }))
      .filter(brand => brand.name);

    if (!normalizedBrands.length) {
      return "";
    }

    const minVisibleItems = 8;
    const repeatedBrands = [];

    while (repeatedBrands.length < minVisibleItems) {
      repeatedBrands.push(...normalizedBrands);

      if (normalizedBrands.length === 0) {
        break;
      }
    }

    const loopBrands = repeatedBrands.slice(0, Math.max(minVisibleItems, normalizedBrands.length));

    return loopBrands.map(brand => {
      if (brand.logo) {
        return `
          <article class="brand-slide" aria-label="${escapeHtml(brand.name)}">
            <img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)}">
          </article>
        `;
      }

      return `
        <article class="brand-slide brand-slide-text" aria-label="${escapeHtml(brand.name)}">
          <span>${escapeHtml(brand.name)}</span>
        </article>
      `;
    }).join("");
  }

  function renderBrandsMarquee(brands) {
    if (!brandsTrack || !brands?.length) return;

    const loopMarkup = buildBrandsLoop(brands);
    if (!loopMarkup) return;

    brandsTrack.innerHTML = `
      <div class="brands-group">${loopMarkup}</div>
      <div class="brands-group" aria-hidden="true">${loopMarkup}</div>
    `;
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
      renderBrandsMarquee(dbBrands);
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
    product3d?.setProduct(p);
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
      product3d?.setProduct(p);
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
  const loginButton = document.querySelector(".login-button");
  const loginButtonLabel = loginButton?.querySelector("span");

  const btn = document.getElementById("addToCart");
  const dot = document.getElementById("cartCount");
  const guestCartStorageKey = "glow-cart";
  const guestWishlistStorageKey = "glow-wishlist";
  const guestCheckoutStorageKey = "glow-checkout";
  const checkoutAnimationDuration = 10000;

  let cart = [];
  let wishlist = [];
  let currentStoreUser = null;
  let currentStoreProfile = null;

  function currentProduct() {
    return products[index] || null;
  }

  function currentProductName() {
    return productName(currentProduct());
  }

  function productName(product) {
    if (!product) return "";
    return String(product.name || stripTitleHtml(product.title || "")).trim();
  }

  function productKey(product) {
    if (!product) return "";
    return String(product.id || normalizeAssetPath(product.img) || productName(product)).trim();
  }

  function productPriceValue(product) {
    if (!product) return 0;

    const explicitPrice = Number(product.priceValue);

    if (Number.isFinite(explicitPrice) && explicitPrice > 0) {
      return explicitPrice;
    }

    return parseInt(String(product.price || "").replace(/\D/g, ""), 10) || 0;
  }

  function canSyncWithAccount(product) {
    return Boolean(
      currentStoreUser &&
      product?.id &&
      !String(product.id).startsWith("local-")
    );
  }

  function syncErrorMessage(error) {
    if (!error) return "";
    return typeof error === "string" ? error : error.message || "Error inesperado";
  }

  function readStoredCollection(key) {
    try {
      const storedValue = window.localStorage.getItem(key);
      const parsedValue = storedValue ? JSON.parse(storedValue) : [];
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (error) {
      return [];
    }
  }

  function writeStoredCollection(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("No se pudo guardar el estado local:", error);
    }
  }

  function loadGuestWishlist() {
    return readStoredCollection(guestWishlistStorageKey)
      .map(item => ({
        key: String(item?.key || "").trim(),
        productId: item?.productId ? String(item.productId) : null
      }))
      .filter(item => item.key);
  }

  function loadGuestCart() {
    return mergeCartItems(readStoredCollection(guestCartStorageKey)
      .map(item => ({
        key: String(item?.key || "").trim(),
        productId: item?.productId ? String(item.productId) : null,
        name: String(item?.name || "").trim(),
        priceValue: Number(item?.priceValue || 0),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        image: item?.image ? normalizeAssetPath(item.image) : null
      }))
      .filter(item => item.key && item.name));
  }

  function mergeCartItems(items) {
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

  function persistGuestState() {
    if (currentStoreUser) return;

    writeStoredCollection(guestWishlistStorageKey, wishlist);
    writeStoredCollection(guestCartStorageKey, cart);
  }

  function setAccountButtonState(href, label) {
    if (!loginButton) return;

    loginButton.setAttribute("href", href);

    if (loginButtonLabel) {
      loginButtonLabel.textContent = label;
    }
  }

  function syncAccountButton() {
    if (!currentStoreUser) {
      setAccountButtonState("auth.html", "LOGIN");
      return;
    }

    if (currentStoreProfile?.role === "admin") {
      setAccountButtonState("dashboard.html", "DASHBOARD");
      return;
    }

    setAccountButtonState("mi-cuenta.html", "MI CUENTA");
  }

  function updateWishlistButton() {
    if (!addToWishlist) return;
    const currentKey = productKey(currentProduct());
    addToWishlist.classList.toggle("active", wishlist.some(item => item.key === currentKey));
  }

  function renderWishlistCount() {
    wishlistCount.textContent = wishlist.length;
    wishlistCount.style.opacity = wishlist.length > 0 ? "1" : "0";
    wishlistCount.style.transform = wishlist.length > 0 ? "scale(1)" : "scale(0)";
  }

  async function toggleWishlistItem() {
    const product = currentProduct();
    const key = productKey(product);

    if (!product || !key) return;

    const existingItem = wishlist.find(item => item.key === key);

    if (existingItem) {
      if (canSyncWithAccount(product) && window.GlowDB?.removeWishlistItem) {
        const { error } = await window.GlowDB.removeWishlistItem(product.id);
        const message = syncErrorMessage(error);

        if (message) {
          alert(`No se pudo actualizar la lista de deseos: ${message}`);
          return;
        }
      }

      wishlist = wishlist.filter(item => item.key !== key);
    } else {
      if (canSyncWithAccount(product) && window.GlowDB?.addWishlistItem) {
        const { error } = await window.GlowDB.addWishlistItem(product.id);
        const message = syncErrorMessage(error);

        if (message) {
          alert(`No se pudo actualizar la lista de deseos: ${message}`);
          return;
        }
      }

      wishlist.push({
        key,
        productId: canSyncWithAccount(product) ? product.id : null
      });
    }

    persistGuestState();
    renderWishlistCount();
    updateWishlistButton();
  }

  addToWishlist.addEventListener("click", () => {
    toggleWishlistItem();
  });

  renderWishlistCount();

  function animateAddToCart() {
    btn.classList.remove("added");
    dot.classList.remove("cart-bump");
    btn.offsetHeight;
    dot.offsetHeight;
    btn.classList.add("added");
    dot.classList.add("cart-bump");
  }

  function renderCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    dot.textContent = totalItems;
    dot.style.opacity = totalItems > 0 ? "1" : "0";
    dot.style.transform = totalItems > 0 ? "scale(1)" : "scale(0)";
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
  btn.addEventListener("click", async () => {
    const product = currentProduct();
    const key = productKey(product);

    if (!product || !key) return;

    const existingItem = cart.find(item => item.key === key);
    const nextQuantity = Number(existingItem?.quantity || 0) + 1;

    if (canSyncWithAccount(product) && window.GlowDB?.setCartItemQuantity) {
      const result = await window.GlowDB.setCartItemQuantity(product.id, nextQuantity);
      const syncError = syncErrorMessage(result?.error);

      if (syncError) {
        alert(`No se pudo actualizar el carrito: ${syncError}`);
        return;
      }
    }

    if (existingItem) {
      existingItem.quantity = nextQuantity;
    } else {
      cart.push({
        key,
        productId: canSyncWithAccount(product) ? product.id : null,
        name: productName(product),
        priceValue: productPriceValue(product),
        quantity: 1,
        image: normalizeAssetPath(product.img)
      });
    }

    cart = mergeCartItems(cart);
    persistGuestState();
    renderCart();
    animateAddToCart();
  });

  function renderCart() {

    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `<p class="empty">Tu carrito está vacío</p>`;
      cartTotal.textContent = "0";
      renderCartCount();
      return;
    }

    let total = 0;

    cart.forEach((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const subtotal = Number(item.priceValue || 0) * quantity;
      total += subtotal;

      const div = document.createElement("div");
      div.classList.add("cart-item");
      const nameNode = document.createElement("span");
      const priceNode = document.createElement("span");
      const removeButton = document.createElement("button");

      nameNode.textContent = quantity > 1 ? `${item.name} x${quantity}` : item.name;
      priceNode.textContent = formatProductPrice(subtotal);
      removeButton.className = "remove";
      removeButton.type = "button";
      removeButton.dataset.cartRemove = item.key;
      removeButton.textContent = "✕";

      div.append(nameNode, priceNode, removeButton);
      cartItemsContainer.appendChild(div);
    });

    cartTotal.textContent = total.toLocaleString("es-AR");
    renderCartCount();
  }

  async function removeCartItemByKey(key) {
    const item = cart.find(entry => entry.key === key);
    if (!item) return;

    if (currentStoreUser && item.productId && window.GlowDB?.removeCartItem) {
      const result = await window.GlowDB.removeCartItem(item.productId);
      const syncError = syncErrorMessage(result?.error);

      if (syncError) {
        alert(`No se pudo actualizar el carrito: ${syncError}`);
        return;
      }
    }

    cart = cart.filter(entry => entry.key !== key);
    persistGuestState();
    renderCart();
  }

  cartItemsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-cart-remove]");
    if (!removeButton) return;

    removeCartItemByKey(removeButton.dataset.cartRemove);
  });

  async function hydrateCollections() {
    if (!window.GlowDB?.isConfigured || !window.GlowDB.getCurrentUser) {
      wishlist = loadGuestWishlist();
      cart = loadGuestCart();
      renderWishlistCount();
      renderCart();
      updateWishlistButton();
      syncAccountButton();
      return;
    }

    currentStoreUser = await window.GlowDB.getCurrentUser();
    currentStoreProfile = currentStoreUser && window.GlowDB.getOwnProfile
      ? await window.GlowDB.getOwnProfile()
      : null;

    if (!currentStoreUser) {
      wishlist = loadGuestWishlist();
      cart = loadGuestCart();
      renderWishlistCount();
      renderCart();
      updateWishlistButton();
      syncAccountButton();
      return;
    }

    syncAccountButton();

    const [wishlistItems, cartItems] = await Promise.all([
      window.GlowDB.listWishlistItems ? window.GlowDB.listWishlistItems() : [],
      window.GlowDB.listCartItems ? window.GlowDB.listCartItems() : []
    ]);

    wishlist = wishlistItems.map(item => ({
      key: String(item.product_id),
      productId: item.product_id
    }));

    cart = cartItems.map(item => ({
      key: String(item.product_id),
      productId: item.product_id,
      name: item.products?.name || "Producto",
      priceValue: Number(item.products?.price || 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      image: normalizeAssetPath(item.products?.image_path)
    }));
    cart = mergeCartItems(cart);

    renderWishlistCount();
    renderCart();
    updateWishlistButton();
  }

  const checkoutOrder = document.getElementById("checkoutOrder");

  function buildCheckoutPayload() {
    if (!cart.length) {
      return null;
    }

    const items = mergeCartItems(cart.map(item => ({
      key: String(item.key || "").trim(),
      productId: item.productId ? String(item.productId) : null,
      name: String(item.name || "Producto").trim(),
      priceValue: Number(item.priceValue || 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      image: item.image ? normalizeAssetPath(item.image) : null
    })).filter(item => item.key && item.name));

    if (!items.length) {
      return null;
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + item.priceValue * item.quantity;
    }, 0);

    return {
      createdAt: new Date().toISOString(),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal
    };
  }

  function persistCheckoutPayload(payload) {
    try {
      window.sessionStorage.setItem(guestCheckoutStorageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("No se pudo guardar el checkout temporal:", error);
    }
  }

  checkoutOrder.addEventListener("click", () => {
    if (checkoutOrder.classList.contains("animate")) return;

    const checkoutPayload = buildCheckoutPayload();

    if (!checkoutPayload) {
      alert("Agrega al menos un producto al carrito para continuar a la pasarela.");
      return;
    }

    persistCheckoutPayload(checkoutPayload);

    checkoutOrder.classList.add("animate");

    setTimeout(() => {
      checkoutOrder.classList.remove("animate");
      window.location.href = "pasarela.html";
    }, checkoutAnimationDuration);
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

  renderCart();
  loadProductsFromSupabase();
  hydrateCollections();

});
