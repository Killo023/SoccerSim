import { supabase } from '../../supabase/client'
import type { DraftPick } from '../../supabase/types'

export async function saveDraftPicks(leagueId: string, memberId: string, picks: Omit<DraftPick, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase.rpc('save_draft_picks', {
    p_league_id: leagueId,
    p_member_id: memberId,
    p_picks: JSON.parse(JSON.stringify(picks)),
  })
  if (error) throw error
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
  const { error } = await supabase.rpc('mark_draft_complete', { p_member_id: memberId })
  if (error) throw error
}

export async function allDraftsComplete(leagueId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('all_drafts_complete', { p_league_id: leagueId })
  if (error) throw error
  return data ?? false
}
