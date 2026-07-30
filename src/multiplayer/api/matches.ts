import { supabase } from '../../supabase/client'
import type { MatchRecord } from '../../supabase/types'

export async function saveMatchResult(match: Omit<MatchRecord, 'id' | 'played_at' | 'created_at' | 'commentary'> & { commentary?: string | null }): Promise<void> {
  const { error } = await supabase.from('matches').insert({
    ...match,
    commentary: match.commentary ?? null,
    played_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function updateMatchResult(id: string, updates: Partial<Omit<MatchRecord, 'id' | 'created_at'>>): Promise<boolean> {
  const { error } = await supabase.rpc('update_match_result', {
    p_match_id: id,
    p_home_goals: updates.home_goals ?? 0,
    p_away_goals: updates.away_goals ?? 0,
    p_home_shots: updates.home_shots ?? 0,
    p_away_shots: updates.away_shots ?? 0,
    p_home_shots_on_target: updates.home_shots_on_target ?? 0,
    p_away_shots_on_target: updates.away_shots_on_target ?? 0,
    p_home_possession: updates.home_possession ?? 50,
    p_status: updates.status ?? 'pending',
    p_commentary: updates.commentary ?? null,
  })
  if (error) {
    console.warn('update_match_result RPC failed, falling back to direct update:', error.message)
    const { data, error: directError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
    if (directError) {
      console.error('Direct match update also failed:', directError.message)
      return false
    }
    return (data ?? []).length > 0
  }
  return true
}

export async function claimMatch(matchId: string, userId?: string): Promise<boolean> {
  const updates: any = { status: 'playing' }
  if (userId) updates.playing_member_id = userId
  const { data } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .eq('status', 'pending')
    .select('id')
  return (data ?? []).length > 0
}

export async function getLeagueMatches(leagueId: string): Promise<MatchRecord[]> {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('league_id', leagueId)
    .order('week_number')
    .order('created_at')
    .limit(5000)
  return (data ?? []) as MatchRecord[]
}

export async function getMatchById(matchId: string): Promise<MatchRecord | null> {
  const { data } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle()
  return data as MatchRecord | null
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

export async function advanceLeagueWeek(leagueId: string, expectedWeek?: number): Promise<void> {
  if (expectedWeek !== undefined) {
    const { data: league } = await supabase.from('leagues').select('current_week').eq('id', leagueId).maybeSingle()
    const current = league ? ((league as any).current_week ?? 0) : 0
    if (current !== expectedWeek) return
  }
  const { error } = await supabase.rpc('advance_league_week', { p_league_id: leagueId })
  if (error) {
    console.warn('advance_league_week RPC failed, falling back:', error.message)
    const { data: league, error: selErr } = await supabase.from('leagues').select('current_week').eq('id', leagueId).maybeSingle()
    if (selErr) { console.error('Cannot read league for fallback:', selErr.message); return }
    const current = league ? ((league as any).current_week ?? 0) : 0
    const { error: updErr } = await supabase.from('leagues').update({ current_week: current + 1 }).eq('id', leagueId).eq('current_week', current)
    if (updErr) console.error('Fallback league advance failed:', updErr.message)
  }
}
