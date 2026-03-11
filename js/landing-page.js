import { getSession, getUserDisplayName, isSupabaseConfigured } from "./auth-client.js";

async function initLanding() {
  const primaryCta = document.getElementById("landingPrimaryCta");
  const secondaryCta = document.getElementById("landingSecondaryCta");
  const statusNode = document.getElementById("landingAuthStatus");

  if (!primaryCta || !secondaryCta || !statusNode) return;

  if (!isSupabaseConfigured()) {
    statusNode.textContent = "Autenticacion pendiente de configurar en Supabase.";
    return;
  }

  try {
    const session = await getSession();
    if (!session) return;
    const label = getUserDisplayName(session.user);
    primaryCta.textContent = "Entrar al workspace";
    primaryCta.href = "app.html";
    secondaryCta.textContent = "Gestionar mi cuenta";
    secondaryCta.href = "auth.html";
    statusNode.textContent = `Sesion detectada: ${label}`;
  } catch (error) {
    statusNode.textContent = "No se pudo leer la sesion actual.";
  }
}

document.addEventListener("DOMContentLoaded", initLanding);
