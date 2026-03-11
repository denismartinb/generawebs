import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, getAbsoluteUrl, isSupabaseConfigured } from "./supabase-config.js";

export { isSupabaseConfigured };

let supabaseClient = null;

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
