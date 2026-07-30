import { supabase } from '../../supabase/client'
import type { DraftPick } from '../../supabase/types'

export async function saveDraftPicks(leagueId: string, memberId: string, picks: Omit<DraftPick, 'id' | 'created_at'>[]): Promise<void> {
  await supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('member_id', memberId)
  if (picks.length > 0) {
    const { error } = await supabase.from('draft_picks').insert(picks)
    if (error) throw error
  }
}

export async function getDraftPicks(leagueId: string): Promise<DraftPick[]> {
  const { data } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('league_id', leagueId)
    .order('pick_round')
    .order('pick_order')
  return (data ?? []) as DraftPick[]
}

export async function getMemberDraftPicks(memberId: string): Promise<DraftPick[]> {
  const { data } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('member_id', memberId)
    .order('pick_round')
    .order('pick_order')
  return (data ?? []) as DraftPick[]
}

export async function markDraftComplete(memberId: string): Promise<void> {
  await supabase.from('league_members').update({ draft_completed: true }).eq('id', memberId)
}

export async function allDraftsComplete(leagueId: string): Promise<boolean> {
  const { data } = await supabase
    .from('league_members')
    .select('draft_completed')
    .eq('league_id', leagueId)
  if (!data || data.length === 0) return false
  return (data as any[]).every(d => d.draft_completed)
}
