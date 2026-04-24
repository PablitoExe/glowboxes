(function () {
  const config = window.GLOW_SUPABASE_CONFIG || {};
  const hasConfig =
    config.url &&
    config.anonKey &&
    !config.url.includes("PEGAR_") &&
    !config.anonKey.includes("PEGAR_");

  const client = hasConfig && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  async function getCurrentUser() {
    if (!client) return null;

    const { data, error } = await client.auth.getUser();

    if (error) {
      console.error("Supabase auth user error:", error);
      return null;
    }

    return data?.user || null;
  }

  async function getOwnProfile() {
    if (!client) return null;

    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Supabase profile error:", error);
    }

    return {
      id: user.id,
      email: user.email || "",
      full_name: data?.full_name || user.user_metadata?.full_name || user.email || "Glow Boxes",
      role: data?.role || null
    };
  }

  async function listProducts() {
    if (!client) return [];

    const { data, error } = await client
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
        categories(name)
      `)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase products error:", error);
      return [];
    }

    return data || [];
  }

  async function listFeaturedProducts() {
    if (!client) return [];

    const { data, error } = await client
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
        categories(name)
      `)
      .eq("active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase featured products error:", error);
      return [];
    }

    return data || [];
  }

  async function listProductsByBrandName(brandName) {
    if (!client) return [];

    const { data, error } = await client
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
        brands!inner(name),
        categories(name)
      `)
      .eq("active", true)
      .eq("brands.name", brandName)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase brand products error:", error);
      return [];
    }

    return data || [];
  }

  async function listBrands() {
    if (!client) return [];

    const { data, error } = await client
      .from("brands")
      .select("id, name, logo_path, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase brands error:", error);
      return [];
    }

    return data || [];
  }

  async function listCategories() {
    if (!client) return [];

    const { data, error } = await client
      .from("categories")
      .select("id, name")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase categories error:", error);
      return [];
    }

    return data || [];
  }

  async function addWishlistItem(productId) {
    if (!client) return { data: null, error: "Supabase no configurado" };

    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: "Necesitás iniciar sesión" };
    }

    return client
      .from("wishlist_items")
      .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })
      .select()
      .single();
  }

  async function removeWishlistItem(productId) {
    if (!client) return { error: "Supabase no configurado" };

    const user = await getCurrentUser();

    if (!user) {
      return { error: "Necesitás iniciar sesión" };
    }

    return client
      .from("wishlist_items")
      .delete()
      .eq("product_id", productId);
  }

  async function listWishlistItems() {
    if (!client) return [];

    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("wishlist_items")
      .select(`
        product_id,
        products(id, name, price, image_path)
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase wishlist error:", error);
      return [];
    }

    return data || [];
  }

  async function addCartItem(productId, quantity = 1) {
    if (!client) return { data: null, error: "Supabase no configurado" };

    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: "Necesitás iniciar sesión" };
    }

    return client
      .from("cart_items")
      .upsert({ user_id: user.id, product_id: productId, quantity }, { onConflict: "user_id,product_id" })
      .select()
      .single();
  }

  async function setCartItemQuantity(productId, quantity) {
    if (!client) return { data: null, error: "Supabase no configurado" };

    const normalizedQuantity = Number(quantity || 0);

    if (normalizedQuantity <= 0) {
      return removeCartItem(productId);
    }

    return addCartItem(productId, normalizedQuantity);
  }

  async function removeCartItem(productId) {
    if (!client) return { error: "Supabase no configurado" };

    const user = await getCurrentUser();

    if (!user) {
      return { error: "Necesitás iniciar sesión" };
    }

    return client
      .from("cart_items")
      .delete()
      .eq("product_id", productId);
  }

  async function listCartItems() {
    if (!client) return [];

    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("cart_items")
      .select(`
        product_id,
        quantity,
        products(id, name, price, image_path)
      `)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase cart error:", error);
      return [];
    }

    return data || [];
  }

  async function listOwnOrders() {
    if (!client) return [];

    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("orders")
      .select(`
        id,
        subtotal,
        discount,
        tax,
        total,
        status,
        shipping_type,
        shipping_carrier,
        tracking_code,
        payment_method,
        payment_status,
        payment_receipt_path,
        mercado_pago_preference_id,
        mercado_pago_init_point,
        customer_phone,
        created_at,
        updated_at,
        order_status_history(
          id,
          status,
          timestamp
        ),
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
      console.error("Supabase orders error:", error);
      return [];
    }

    return data || [];
  }

  window.GlowDB = {
    client,
    isConfigured: Boolean(client),
    getCurrentUser,
    getOwnProfile,
    listProducts,
    listFeaturedProducts,
    listProductsByBrandName,
    listBrands,
    listCategories,
    addWishlistItem,
    removeWishlistItem,
    listWishlistItems,
    addCartItem,
    setCartItemQuantity,
    removeCartItem,
    listCartItems,
    listOwnOrders
  };
})();
