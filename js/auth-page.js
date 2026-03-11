let authApi = null;
let authApiLoadError = "";

function setStatus(message, type = "") {
  const node = document.getElementById("authStatus");
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
  node.dataset.type = type;
}

function switchMode(mode) {
  const sections = document.querySelectorAll("[data-auth-panel]");
  const tabs = document.querySelectorAll("[data-auth-tab]");
  sections.forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== mode;
  });
  tabs.forEach((tab) => {
    const active = tab.dataset.authTab === mode;
    tab.dataset.active = active ? "true" : "false";
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function setBusy(form, isBusy, labelBusy) {
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  submit.disabled = isBusy;
  submit.dataset.originalLabel = submit.dataset.originalLabel || submit.textContent;
  submit.textContent = isBusy ? labelBusy : submit.dataset.originalLabel;
}

function bindTabUi() {
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchMode(tab.dataset.authTab);
      setStatus("");
    });
  });
}

async function loadAuthApi() {
  if (authApi) return authApi;
  try {
    authApi = await import("./auth-client.js");
    authApiLoadError = "";
    return authApi;
  } catch (error) {
    const details = error && error.message ? error.message : String(error || "");
    authApiLoadError = details;
    console.error("No se pudo cargar auth-client.js", error);
    return null;
  }
}

function getUnavailableMessage(actionText) {
  if (authApiLoadError) {
    if (window.location.protocol === "file:") {
      return `No se puede activar ${actionText} abriendo el HTML directamente. Sirve el proyecto por http://localhost o publícalo en GitHub Pages.`;
    }
    return `No se pudo cargar el cliente de autenticacion. Revisa la conexion de red, la consola del navegador y el acceso al CDN de Supabase.`;
  }
  return `Configura Supabase antes de ${actionText}.`;
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = String(form.elements.login_email.value || "").trim();
  const password = String(form.elements.login_password.value || "");
  setBusy(form, true, "Entrando...");
  setStatus("");
  try {
    const api = await loadAuthApi();
    if (!api || !api.isSupabaseConfigured()) {
      throw new Error(getUnavailableMessage("iniciar sesion"));
    }
    await api.signInWithPassword({ email, password });
    window.location.href = api.readNextPath("app.html");
  } catch (error) {
    setStatus(error.message || "No se pudo iniciar sesion.", "error");
  } finally {
    setBusy(form, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fullName = String(form.elements.register_name.value || "").trim();
  const email = String(form.elements.register_email.value || "").trim();
  const password = String(form.elements.register_password.value || "");
  setBusy(form, true, "Creando cuenta...");
  setStatus("");
  try {
    const api = await loadAuthApi();
    if (!api || !api.isSupabaseConfigured()) {
      throw new Error(getUnavailableMessage("registrar usuarios"));
    }
    const data = await api.signUpWithPassword({ email, password, fullName });
    if (data.session) {
      window.location.href = api.readNextPath("app.html");
      return;
    }
    setStatus("Cuenta creada. Revisa tu email para confirmar el acceso.", "success");
    switchMode("login");
  } catch (error) {
    setStatus(error.message || "No se pudo crear la cuenta.", "error");
  } finally {
    setBusy(form, false);
  }
}

async function handleRecovery(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = String(form.elements.recovery_email.value || "").trim();
  setBusy(form, true, "Enviando...");
  setStatus("");
  try {
    const api = await loadAuthApi();
    if (!api || !api.isSupabaseConfigured()) {
      throw new Error(getUnavailableMessage("recuperar contrasenas"));
    }
    await api.sendPasswordRecovery(email);
    setStatus("Te hemos enviado un email para restablecer la contrasena.", "success");
  } catch (error) {
    setStatus(error.message || "No se pudo enviar el email de recuperacion.", "error");
  } finally {
    setBusy(form, false);
  }
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const password = String(form.elements.update_password.value || "");
  setBusy(form, true, "Actualizando...");
  setStatus("");
  try {
    const api = await loadAuthApi();
    if (!api || !api.isSupabaseConfigured()) {
      throw new Error(getUnavailableMessage("actualizar la contrasena"));
    }
    await api.updatePassword(password);
    setStatus("Contrasena actualizada. Ya puedes entrar.", "success");
    switchMode("login");
  } catch (error) {
    setStatus(error.message || "No se pudo actualizar la contrasena.", "error");
  } finally {
    setBusy(form, false);
  }
}

function bindForms() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const recoveryForm = document.getElementById("recoveryForm");
  const updateForm = document.getElementById("updatePasswordForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (registerForm) registerForm.addEventListener("submit", handleRegister);
  if (recoveryForm) recoveryForm.addEventListener("submit", handleRecovery);
  if (updateForm) updateForm.addEventListener("submit", handlePasswordUpdate);
}

async function initAuthPage() {
  const configBadge = document.getElementById("authConfigNotice");
  const sessionBadge = document.getElementById("authSessionBadge");
  const params = new URLSearchParams(window.location.search);
  const forcedMode = String(params.get("mode") || "").trim();
  const isRecoveryFlow = window.location.hash.includes("type=recovery") || forcedMode === "update-password";

  bindTabUi();
  bindForms();

  if (isRecoveryFlow) {
    switchMode("update-password");
  } else if (forcedMode === "register" || forcedMode === "recovery") {
    switchMode(forcedMode);
  } else {
    switchMode("login");
  }

  const api = await loadAuthApi();
  if (!api || !api.isSupabaseConfigured()) {
    if (configBadge) {
      configBadge.hidden = false;
      configBadge.textContent = getUnavailableMessage("activar el acceso de usuarios");
    }
    return;
  }

  const session = await api.getSession().catch(() => null);
  if (session && !isRecoveryFlow && sessionBadge) {
    sessionBadge.hidden = false;
    sessionBadge.textContent = `Sesion activa: ${api.getUserDisplayName(session.user)}. Puedes ir al workspace.`;
  }
}

document.addEventListener("DOMContentLoaded", initAuthPage);
