const tabs = document.querySelectorAll("[data-auth-tab]");
const forms = document.querySelectorAll(".auth-form");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");

function setMessage(text, type = "") {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`.trim();
}

function setLoading(form, isLoading) {
  const button = form.querySelector("button");
  button.disabled = isLoading;
  button.textContent = isLoading ? "Procesando..." : button.dataset.defaultText;
}

function redirectToDashboard() {
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get("redirect") || "dashboard.html";
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.authTab;

    tabs.forEach(item => item.classList.toggle("active", item === tab));
    forms.forEach(form => form.classList.toggle("active", form.id === `${target}Form`));
    setMessage("");
  });
});

forms.forEach(form => {
  const button = form.querySelector("button");
  button.dataset.defaultText = button.textContent;
});

async function checkExistingSession() {
  if (!window.GlowDB?.client) return;

  const { data } = await window.GlowDB.client.auth.getSession();
  const session = data.session;
  if (!session) return;

  const { data: profile } = await window.GlowDB.client
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role === "admin") {
    redirectToDashboard();
    return;
  }

  await window.GlowDB.client.auth.signOut();
  setMessage("La sesion anterior no tenia permisos de administrador. Volve a ingresar con tu cuenta admin.", "error");
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

  const { error } = await window.GlowDB.client.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });

  setLoading(loginForm, false);

  if (error) {
    setMessage(`No se pudo iniciar sesion: ${error.message}`, "error");
    return;
  }

  setMessage("Sesion iniciada. Entrando al dashboard...", "success");
  window.setTimeout(redirectToDashboard, 550);
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
    await window.GlowDB.client
      .from("profiles")
      .upsert({
        id: data.user.id,
        full_name: fullName,
        role: "cliente"
      });

    setLoading(registerForm, false);
    setMessage("Cuenta creada. Entrando al dashboard...", "success");
    window.setTimeout(redirectToDashboard, 650);
    return;
  }

  setLoading(registerForm, false);
  setMessage("Cuenta creada. Revisa tu email para confirmar el registro.", "success");
  registerForm.reset();
});

checkExistingSession();
