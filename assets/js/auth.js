const tabs = document.querySelectorAll("[data-auth-tab]");
const authTabs = document.querySelector(".auth-tabs");
const authTabsPill = document.querySelector(".auth-tabs-pill");
const forms = document.querySelectorAll(".auth-form");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const googleAuthButton = document.getElementById("googleAuthButton");
const authMessage = document.getElementById("authMessage");
const defaultAdminRedirect = "dashboard.html";
const defaultCustomerRedirect = "mi-cuenta.html";
const defaultStoreRedirect = "index.html";
const defaultCheckoutRedirect = "pasarela.html";
const allowedRedirectTargets = [
  defaultAdminRedirect,
  defaultCustomerRedirect,
  defaultStoreRedirect,
  defaultCheckoutRedirect
];

function setMessage(text, type = "") {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`.trim();
}

function setLoading(form, isLoading) {
  const button = form.querySelector("button");
  button.disabled = isLoading;
  button.textContent = isLoading ? "Procesando..." : button.dataset.defaultText;
}

function setGoogleLoading(isLoading) {
  if (!googleAuthButton) return;

  const label = googleAuthButton.querySelector(".google-auth-label");
  googleAuthButton.disabled = isLoading;

  if (label) {
    label.textContent = isLoading ? "Conectando..." : "Continuar con Google";
  }
}

function getSafeRedirectTarget(allowedPaths, fallback) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");

  if (!redirect) {
    return fallback;
  }

  try {
    const resolved = new URL(redirect, window.location.href);
    const normalizedPath = resolved.pathname.replace(/^\//, "");
    const isAllowedPath = allowedPaths.includes(normalizedPath);

    if (resolved.origin !== window.location.origin || !isAllowedPath) {
      return fallback;
    }

    return `${normalizedPath}${resolved.search}${resolved.hash}`;
  } catch (error) {
    return fallback;
  }
}

function redirectTo(target) {
  window.location.href = target;
}

function getAuthCallbackUrl() {
  const redirectTarget = getSafeRedirectTarget(allowedRedirectTargets, "");
  const callbackUrl = new URL("auth.html", window.location.href);

  if (redirectTarget) {
    callbackUrl.searchParams.set("redirect", redirectTarget);
  }

  return callbackUrl.toString();
}

function moveAuthTabsPill(activeTab) {
  if (!authTabs || !authTabsPill || !activeTab) return;

  const tabsRect = authTabs.getBoundingClientRect();
  const activeRect = activeTab.getBoundingClientRect();
  const nextWidth = activeRect.width;
  const nextOffset = activeRect.left - tabsRect.left;

  authTabsPill.style.width = `${nextWidth}px`;
  authTabsPill.style.transform = `translateX(${nextOffset}px)`;
}

async function syncOwnProfile(user, fullName = "") {
  const profileName = String(fullName || user?.user_metadata?.full_name || user?.email || "").trim();

  if (!user?.id) {
    return { role: null, error: "Usuario no disponible" };
  }

  const { data: profile, error: profileError } = await window.GlowDB.client
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("No se pudo leer el perfil:", profileError);
    return { role: null, error: profileError };
  }

  if (profile) {
    if (!profile.full_name && profileName) {
      await window.GlowDB.client
        .from("profiles")
        .update({ full_name: profileName })
        .eq("id", user.id);
    }

    return {
      role: profile.role || "cliente",
      error: null
    };
  }

  const { error: insertError } = await window.GlowDB.client
    .from("profiles")
    .insert({
      id: user.id,
      full_name: profileName || user.email
    });

  if (insertError) {
    console.error("No se pudo crear el perfil:", insertError);

    const { data: retryProfile, error: retryError } = await window.GlowDB.client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      role: retryProfile?.role || null,
      error: retryError || insertError
    };
  }

  return {
    role: "cliente",
    error: null
  };
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.authTab;

    tabs.forEach(item => item.classList.toggle("active", item === tab));
    forms.forEach(form => form.classList.toggle("active", form.id === `${target}Form`));
    moveAuthTabsPill(tab);
    setMessage("");
  });
});

window.addEventListener("resize", () => {
  moveAuthTabsPill(document.querySelector(".auth-tabs button.active"));
});

forms.forEach(form => {
  const button = form.querySelector("button");
  button.dataset.defaultText = button.textContent;
});

moveAuthTabsPill(document.querySelector(".auth-tabs button.active"));

async function checkExistingSession() {
  if (!window.GlowDB?.client) return;

  const { data } = await window.GlowDB.client.auth.getSession();
  const session = data.session;
  if (!session) return;

  const { role } = await syncOwnProfile(session.user);

  if (role === "admin") {
    redirectTo(getSafeRedirectTarget([
      defaultAdminRedirect,
      defaultCustomerRedirect,
      defaultStoreRedirect,
      defaultCheckoutRedirect
    ], defaultAdminRedirect));
    return;
  }

  redirectTo(getSafeRedirectTarget([
    defaultCustomerRedirect,
    defaultStoreRedirect,
    defaultCheckoutRedirect
  ], defaultCustomerRedirect));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    setMessage("Supabase no esta configurado.", "error");
    return;
  }

  const formData = new FormData(loginForm);
  setLoading(loginForm, true);
  setMessage("");

  const { data, error } = await window.GlowDB.client.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (error) {
    setLoading(loginForm, false);
    setMessage(`No se pudo iniciar sesion: ${error.message}`, "error");
    return;
  }

  const { role, error: profileError } = await syncOwnProfile(data.user);
  setLoading(loginForm, false);

  if (profileError) {
    setMessage("La sesion se inicio, pero no pudimos validar el perfil. Intenta de nuevo.", "error");
    return;
  }

  if (role === "admin") {
    setMessage("Sesion iniciada. Entrando al dashboard...", "success");
    window.setTimeout(() => redirectTo(getSafeRedirectTarget([
      defaultAdminRedirect,
      defaultCustomerRedirect,
      defaultStoreRedirect,
      defaultCheckoutRedirect
    ], defaultAdminRedirect)), 550);
    return;
  }

  setMessage("Sesion iniciada. Entrando a tu cuenta...", "success");
  window.setTimeout(() => redirectTo(getSafeRedirectTarget([
    defaultCustomerRedirect,
    defaultStoreRedirect,
    defaultCheckoutRedirect
  ], defaultCustomerRedirect)), 650);
});

googleAuthButton?.addEventListener("click", async () => {
  if (!window.GlowDB?.client) {
    setMessage("Supabase no esta configurado.", "error");
    return;
  }

  setGoogleLoading(true);
  setMessage("");

  const { error } = await window.GlowDB.client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error) {
    setGoogleLoading(false);
    setMessage(`No se pudo iniciar con Google: ${error.message}`, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!window.GlowDB?.client) {
    setMessage("Supabase no esta configurado.", "error");
    return;
  }

  const formData = new FormData(registerForm);
  const fullName = String(formData.get("full_name") || "").trim();
  setLoading(registerForm, true);
  setMessage("");

  const { data, error } = await window.GlowDB.client.auth.signUp({
    email: formData.get("email"),
    password: formData.get("password"),
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    setLoading(registerForm, false);
    setMessage(`No se pudo crear la cuenta: ${error.message}`, "error");
    return;
  }

  if (data.session && data.user) {
    const { role, error: profileError } = await syncOwnProfile(data.user, fullName);

    setLoading(registerForm, false);

    if (profileError) {
      setMessage("La cuenta se creo, pero no pudimos validar el perfil. Intenta iniciar sesion otra vez.", "error");
      return;
    }

    if (role === "admin") {
      setMessage("Cuenta creada. Entrando al dashboard...", "success");
      window.setTimeout(() => redirectTo(getSafeRedirectTarget([
        defaultAdminRedirect,
        defaultCustomerRedirect,
        defaultStoreRedirect,
        defaultCheckoutRedirect
      ], defaultAdminRedirect)), 650);
      return;
    }

    setMessage("Cuenta creada. Entrando a tu cuenta...", "success");
    window.setTimeout(() => redirectTo(getSafeRedirectTarget([
      defaultCustomerRedirect,
      defaultStoreRedirect,
      defaultCheckoutRedirect
    ], defaultCustomerRedirect)), 750);
    return;
  }

  setLoading(registerForm, false);
  setMessage("Cuenta creada. Revisa tu email para confirmar el registro.", "success");
  registerForm.reset();
});

checkExistingSession();
