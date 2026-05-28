const URL_KEY = "__supabase_url__";

let _supabaseUrl = sessionStorage.getItem(URL_KEY) || "";

export async function initConfig(): Promise<void> {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    _supabaseUrl = data.supabaseUrl || "";
    if (_supabaseUrl) {
      sessionStorage.setItem(URL_KEY, _supabaseUrl);
    } else {
      sessionStorage.removeItem(URL_KEY);
    }
  } catch {
    console.error("[config] Failed to load runtime config from /api/config");
  }
}

export function getSupabaseUrl(): string {
  if (!_supabaseUrl) {
    _supabaseUrl = sessionStorage.getItem(URL_KEY) || "";
  }
  return _supabaseUrl;
}
