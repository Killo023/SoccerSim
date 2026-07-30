import { supabase } from '../../supabase/client'
import type { MatchRecord } from '../../supabase/types'

export async function saveMatchResult(match: Omit<MatchRecord, 'id' | 'played_at' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('matches').insert({
    ...match,
    played_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function getLeagueMatches(leagueId: string): Promise<MatchRecord[]> {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('league_id', leagueId)
    .order('week_number')
    .order('created_at')
  return (data ?? []) as MatchRecord[]
}

export async function getWeekMatches(leagueId: string, week: number): Promise<MatchRecord[]> {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('league_id', leagueId)
    .eq('week_number', week)
    .order('created_at')
  return (data ?? []) as MatchRecord[]
}

export async function advanceLeagueWeek(leagueId: string): Promise<void> {
  const { data: league } = await supabase.from('leagues').select('current_week').eq('id', leagueId).single()
  if (!league) return
  const current = (league as any).current_week ?? 0
  await supabase.from('leagues').update({ current_week: current + 1 }).eq('id', leagueId)
}
