import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authEnabled, getSupabase, mightBeSignedIn } from '../lib/supabase.js'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (s) => {
    if (!s) { setProfile(null); return }
    try { setProfile(await api('/api/me', { token: s.access_token })) } catch { setProfile(null) }
  }, [])

  const [started, setStarted] = useState(() => authEnabled && mightBeSignedIn())

  useEffect(() => {
    if (!started) { setLoading(false); return }
    let sub, alive = true
    setLoading(true)
    getSupabase().then(async (supabase) => {
      if (!supabase || !alive) return
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
      sub = supabase.auth.onAuthStateChange((event, s) => {
        setSession(s)
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') loadProfile(s)
      }).data.subscription
    })
    return () => { alive = false; sub?.unsubscribe() }
  }, [started, loadProfile])

  const value = {
    session, profile, loading,
    user: session?.user || null,
    isAdmin: profile?.role === 'admin',
    token: session?.access_token || null,
    async getToken() {
      if (!started) return null
      const supabase = await getSupabase()
      if (!supabase) return null
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token || null
    },
    async sendCode(email, next = '') {
      // The email carries a 6-digit code (custom template) and/or a sign-in link (default template). Both work.
      const emailRedirectTo = `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`
      const supabase = await getSupabase()
      setStarted(true)
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })
      if (error) throw new Error(error.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : error.message)
    },
    async verifyCode(email, token) {
      const supabase = await getSupabase()
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw new Error('That code is wrong or has expired. Please check it or send a new one.')
    },
    async signOut() { const supabase = await getSupabase(); await supabase?.auth.signOut(); setSession(null); setProfile(null) },
    refreshProfile: () => loadProfile(session),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** api() with the signed-in user's token attached. */
export function useAuthedApi() {
  const { getToken } = useAuth()
  return useCallback(async (path, opts = {}) => api(path, { ...opts, token: await getToken() }), [getToken])
}
