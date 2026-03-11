import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, getAbsoluteUrl, isSupabaseConfigured } from "./supabase-config.js";

export { isSupabaseConfigured };

let supabaseClient = null;

function isMissingProfilesTableError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Could not find the table 'public.profiles'") ||
    message.includes("relation \"public.profiles\" does not exist") ||
    message.includes("relation \"profiles\" does not exist")
  );
}

export function ensureSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Configura `window.__SUPABASE_URL__` y `window.__SUPABASE_ANON_KEY__` antes de usar la autenticacion.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return supabaseClient;
}

export async function getSession() {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function requireAuth({ redirectTo = "auth.html", next = "app.html" } = {}) {
  const session = await getSession();
  if (session) return session;
  const target = new URL(getAbsoluteUrl(redirectTo));
  target.searchParams.set("next", next);
  window.location.href = target.toString();
  return null;
}

export function onAuthStateChange(callback) {
  const supabase = ensureSupabase();
  return supabase.auth.onAuthStateChange(callback);
}

export async function signInWithPassword({ email, password }) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword({ email, password, fullName }) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      },
      emailRedirectTo: getAbsoluteUrl("auth.html")
    }
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordRecovery(email) {
  const supabase = ensureSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAbsoluteUrl("auth.html?mode=update-password")
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingProfilesTableError(error)) return null;
    throw error;
  }
  return data;
}

export async function saveProfile({ userId, email, fullName, avatarUrl }) {
  const supabase = ensureSupabase();
  const cleanEmail = String(email || "").trim();
  const cleanFullName = String(fullName || "").trim();
  const cleanAvatarUrl = String(avatarUrl || "").trim();

  const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
  if (currentUserError) throw currentUserError;
  const currentUser = currentUserData.user;
  if (!currentUser || currentUser.id !== userId) {
    throw new Error("No se pudo validar la sesion del usuario.");
  }

  const updates = {
    data: {
      ...(currentUser.user_metadata || {}),
      full_name: cleanFullName
    }
  };
  if (cleanEmail && cleanEmail !== currentUser.email) {
    updates.email = cleanEmail;
  }

  const { data: authData, error: authError } = await supabase.auth.updateUser(updates);
  if (authError) throw authError;

  let profileData = null;
  const { data: updatedUserData, error: refreshedUserError } = await supabase.auth.getUser();
  if (refreshedUserError) throw refreshedUserError;
  const updatedUser = updatedUserData.user || authData.user || currentUser;

  const { data: nextProfileData, error: profileError } = await supabase
    .from("profiles")
    .update({
      email: cleanEmail || updatedUser.email || "",
      full_name: cleanFullName,
      avatar_url: cleanAvatarUrl || null
    })
    .eq("id", userId)
    .select("id, email, full_name, avatar_url, created_at, updated_at")
    .single();

  if (profileError) {
    if (!isMissingProfilesTableError(profileError)) throw profileError;
  } else {
    profileData = nextProfileData;
  }

  return {
    profile: profileData,
    user: updatedUser,
    emailChangeRequested: Boolean(updates.email)
  };
}

export async function signOut() {
  const supabase = ensureSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function getUserDisplayName(user) {
  if (!user) return "";
  const fullName = String(user.user_metadata?.full_name || "").trim();
  return fullName || String(user.email || user.phone || `user-${String(user.id || "").slice(0, 8)}`);
}

export function readNextPath(fallback = "app.html") {
  const params = new URLSearchParams(window.location.search);
  const next = String(params.get("next") || "").trim();
  if (!next) return fallback;
  if (/^https?:\/\//i.test(next)) return fallback;
  return next.startsWith("/") ? next.slice(1) : next;
}
