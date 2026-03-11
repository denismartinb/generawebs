import { getUserDisplayName, isSupabaseConfigured, onAuthStateChange, requireAuth, signOut } from "./auth-client.js";

function revealWorkspace() {
  document.body.classList.remove("auth-pending");
}

function updateWorkspaceUser(user) {
  const node = document.getElementById("workspaceUserEmail");
  if (!node) return;
  node.textContent = getUserDisplayName(user);
}

async function initWorkspace() {
  const logoutBtn = document.getElementById("workspaceLogoutBtn");

  if (!isSupabaseConfigured()) {
    updateWorkspaceUser({ email: "Configura Supabase" });
    if (logoutBtn) logoutBtn.disabled = true;
    revealWorkspace();
    return;
  }

  try {
    const session = await requireAuth({ redirectTo: "auth.html", next: "app.html" });
    if (!session) return;
    updateWorkspaceUser(session.user);
    revealWorkspace();

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

    onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        window.location.href = "auth.html";
        return;
      }
      updateWorkspaceUser(nextSession.user);
    });
  } catch (error) {
    window.location.href = "auth.html";
  }
}

document.addEventListener("DOMContentLoaded", initWorkspace);
