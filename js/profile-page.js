import {
  getProfile,
  getUserDisplayName,
  isSupabaseConfigured,
  onAuthStateChange,
  requireAuth,
  saveProfile,
  signOut
} from "./auth-client.js";

let currentSession = null;

function revealPage() {
  document.body.classList.remove("auth-pending");
}

function setStatus(message, type = "") {
  const node = document.getElementById("profileStatus");
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
  node.dataset.type = type;
}

function setBusy(isBusy) {
  const button = document.getElementById("profileSaveBtn");
  if (!button) return;
  button.disabled = isBusy;
  button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
  button.textContent = isBusy ? "Guardando..." : button.dataset.originalLabel;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function updateAvatarPreview(fullName, avatarUrl) {
  const preview = document.getElementById("profileAvatarPreview");
  const fallback = document.getElementById("profileAvatarFallback");
  if (!preview || !fallback) return;

  const cleanUrl = String(avatarUrl || "").trim();
  const initials = String(fullName || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

  preview.innerHTML = "";
  if (cleanUrl) {
    const img = document.createElement("img");
    img.src = cleanUrl;
    img.alt = `Avatar de ${fullName || "usuario"}`;
    img.addEventListener("error", () => {
      preview.innerHTML = "";
      fallback.textContent = initials;
      preview.appendChild(fallback);
    }, { once: true });
    preview.appendChild(img);
    return;
  }

  fallback.textContent = initials;
  preview.appendChild(fallback);
}

function renderProfile(profile, user) {
  const fullName = String(profile?.full_name || user?.user_metadata?.full_name || "").trim();
  const email = String(profile?.email || user?.email || "").trim();
  const avatarUrl = String(profile?.avatar_url || "").trim();
  const displayName = fullName || getUserDisplayName(user);

  const fullNameInput = document.getElementById("profileFullName");
  const emailInput = document.getElementById("profileEmail");
  const avatarInput = document.getElementById("profileAvatarUrl");
  const headerUser = document.getElementById("profileHeaderUser");
  const summaryName = document.getElementById("profileSummaryName");
  const summaryEmail = document.getElementById("profileSummaryEmail");
  const metaUser = document.getElementById("profileMetaUser");
  const metaCreated = document.getElementById("profileMetaCreated");
  const metaUpdated = document.getElementById("profileMetaUpdated");

  if (fullNameInput) fullNameInput.value = fullName;
  if (emailInput) emailInput.value = email;
  if (avatarInput) avatarInput.value = avatarUrl;
  if (headerUser) headerUser.textContent = displayName;
  if (summaryName) summaryName.textContent = displayName;
  if (summaryEmail) summaryEmail.textContent = email || "Sin email";
  if (metaUser) metaUser.textContent = user?.id || "Sin identificador";
  if (metaCreated) metaCreated.textContent = formatDate(profile?.created_at || user?.created_at);
  if (metaUpdated) metaUpdated.textContent = formatDate(profile?.updated_at || user?.updated_at);

  updateAvatarPreview(displayName, avatarUrl);
}

async function loadCurrentProfile() {
  if (!currentSession?.user) return;
  const profile = await getProfile(currentSession.user.id);
  renderProfile(profile, currentSession.user);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentSession?.user) return;

  const form = event.currentTarget;
  const fullName = String(form.elements.full_name.value || "").trim();
  const email = String(form.elements.email.value || "").trim();
  const avatarUrl = String(form.elements.avatar_url.value || "").trim();

  setBusy(true);
  setStatus("");

  try {
    const result = await saveProfile({
      userId: currentSession.user.id,
      email,
      fullName,
      avatarUrl
    });
    currentSession.user = result.user || currentSession.user;
    renderProfile(result.profile, currentSession.user);
    setStatus(
      result.emailChangeRequested
        ? "Perfil actualizado. Revisa tu nuevo email para confirmar el cambio si Supabase lo solicita."
        : "Perfil actualizado correctamente.",
      "success"
    );
  } catch (error) {
    setStatus(error.message || "No se pudo guardar el perfil.", "error");
  } finally {
    setBusy(false);
  }
}

async function initProfilePage() {
  const logoutBtn = document.getElementById("profileLogoutBtn");
  const form = document.getElementById("profileForm");
  const avatarInput = document.getElementById("profileAvatarUrl");
  const fullNameInput = document.getElementById("profileFullName");

  if (!isSupabaseConfigured()) {
    setStatus("Supabase no está configurado en este proyecto.", "error");
    revealPage();
    return;
  }

  currentSession = await requireAuth({ redirectTo: "auth.html", next: "profile.html" });
  if (!currentSession) return;

  revealPage();

  if (form) form.addEventListener("submit", handleSubmit);
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await signOut();
      } finally {
        window.location.href = "auth.html";
      }
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener("input", () => {
      updateAvatarPreview(fullNameInput?.value || "", avatarInput.value || "");
    });
  }
  if (fullNameInput) {
    fullNameInput.addEventListener("input", () => {
      updateAvatarPreview(fullNameInput.value || "", avatarInput?.value || "");
    });
  }

  try {
    await loadCurrentProfile();
  } catch (error) {
    renderProfile(null, currentSession.user);
    setStatus(
      "No se pudo cargar la ficha del perfil en la base de datos. Revisa que hayas ejecutado supabase/schema.sql y que la tabla profiles exista con RLS activa.",
      "error"
    );
  }

  onAuthStateChange((_event, nextSession) => {
    if (!nextSession) {
      window.location.href = "auth.html";
      return;
    }
    currentSession = nextSession;
  });
}

document.addEventListener("DOMContentLoaded", initProfilePage);
