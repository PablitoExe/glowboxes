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

    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;

    if (!user) {
      return { data: null, error: "Necesitás iniciar sesión" };
    }

    return client
      .from("wishlist_items")
      .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })
      .select()
      .single();
  }

  async function addCartItem(productId, quantity = 1) {
    if (!client) return { data: null, error: "Supabase no configurado" };

    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;

    if (!user) {
      return { data: null, error: "Necesitás iniciar sesión" };
    }

    return client
      .from("cart_items")
      .upsert({ user_id: user.id, product_id: productId, quantity }, { onConflict: "user_id,product_id" })
      .select()
      .single();
  }

  window.GlowDB = {
    client,
    isConfigured: Boolean(client),
    listProducts,
    listFeaturedProducts,
    listProductsByBrandName,
    listBrands,
    listCategories,
    addWishlistItem,
    addCartItem
  };
})();
