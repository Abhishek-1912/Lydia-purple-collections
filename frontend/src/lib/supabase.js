import { config } from './config.js'

// Browser uses Supabase only for sign-in. All data goes through the API.
// The library is loaded on demand so first-time shoppers don't download it.
export const authEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey)
let clientPromise

export function getSupabase() {
  if (!authEnabled) return Promise.resolve(null)
  clientPromise ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } }))
  return clientPromise
}

/** True if this browser may already be signed in, or is returning from an email link. */
export function mightBeSignedIn() {
  try {
    if (/access_token|token_hash|[?&]code=/.test(window.location.href)) return true
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch { return false }
}
