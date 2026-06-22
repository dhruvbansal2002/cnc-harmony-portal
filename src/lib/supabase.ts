import { createClient } from '@supabase/supabase-js'

type SupabaseClientConfig = {
  url: string
  anonKey: string
}

function readSupabaseConfig(): SupabaseClientConfig {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  }
}

export const supabaseConfig = readSupabaseConfig()

export const isSupabaseConfigured =
  supabaseConfig.url.length > 0 && supabaseConfig.anonKey.length > 0

let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using the portal.',
    )
  }

  supabaseClient ??= createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  })

  return supabaseClient
}
