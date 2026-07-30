import { createClient } from '@supabase/supabase-js'
import type { Profile, League, LeagueMember, DraftPick, MatchRecord } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getProfile(id: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return data as Profile | null
}

export async function getProfilesByIds(ids: string[]) {
  if (ids.length === 0) return []
  const { data } = await supabase.from('profiles').select('*').in('id', ids)
  return (data ?? []) as Profile[]
}
