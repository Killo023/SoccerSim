import { createClient } from '@supabase/supabase-js'
import type { Profile } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

function createStubClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      signOut: async () => {},
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }) }),
        in: () => ({ single: async () => ({ data: null, error: null }) }),
        order: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({}) }),
      delete: () => ({ eq: () => ({}) }),
    }),
  } as any
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createStubClient()

export async function getProfile(id: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return data as Profile | null
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select('*').in('id', ids)
  return (data ?? []) as Profile[]
}
