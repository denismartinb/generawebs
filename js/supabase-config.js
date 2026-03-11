const globalConfig = typeof window !== "undefined" ? window : {};

export const SUPABASE_URL = String(globalConfig.__SUPABASE_URL__ || "https://nmoujjmrnilnamtivmco.supabase.co").trim();
export const SUPABASE_ANON_KEY = String(globalConfig.__SUPABASE_ANON_KEY__ || "sb_publishable_yMoWB8DT7q24VbB68r0aQw_Sjh7BfWC").trim();

export function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20 &&
    /^sb_(publishable|anon)_/i.test(SUPABASE_ANON_KEY)
  );
}

export function getAbsoluteUrl(path) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.href).toString();
}
