import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, getProfile, isSupabaseConfigured } from '../../supabase/client'
import type { Profile } from '../../supabase/types'

export interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  authError: string | null
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  authError: null,
  signUp: async () => { throw new Error('AuthProvider not ready') },
  signIn: async () => { throw new Error('AuthProvider not ready') },
  signOut: async () => { throw new Error('AuthProvider not ready') },
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  async function fetchProfile(userId: string) {
    const p = await getProfile(userId)
    if (p) setProfile(p)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      setLoading(false)
    }).catch((err: Error) => {
      setAuthError('Cannot connect to Supabase. Check your VITE_SUPABASE_URL — the project may be paused or the URL may be wrong.')
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) fetchProfile(s.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, username: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName } },
    })
    if (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Cannot reach Supabase. Check that VITE_SUPABASE_URL is correct and the project is not paused.')
      }
      throw error
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Cannot reach Supabase. Check that VITE_SUPABASE_URL is correct and the project is not paused.')
      }
      throw error
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext value={{ user, profile, session, loading, authError, signUp, signIn, signOut }}>
      {children}
    </AuthContext>
  )
}
