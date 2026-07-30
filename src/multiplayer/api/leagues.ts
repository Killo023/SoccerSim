import { supabase } from '../../supabase/client'
import type { League, LeagueMember } from '../../supabase/types'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function createLeague(
  name: string,
  ownerId: string,
  leagueType: string,
  replacedTeams: number
): Promise<League> {
  let inviteCode: string
  let attempts = 0
  while (true) {
    inviteCode = generateInviteCode()
    const { data: existing } = await supabase
      .from('leagues')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle()
    if (!existing) break
    attempts++
    if (attempts > 10) throw new Error('Could not generate unique invite code')
  }

  const { data, error } = await supabase
    .from('leagues')
    .insert({ name, owner_id: ownerId, invite_code: inviteCode, league_type: leagueType, replaced_teams: replacedTeams })
    .select()
    .single()
  if (error) throw error

  const league = data as League

  await supabase.from('league_members').insert({
    league_id: league.id,
    profile_id: ownerId,
    team_name: `${name} FC`,
    team_color: '#3498db',
  })

  return league
}

export async function joinLeague(inviteCode: string, profileId: string): Promise<League> {
  // Try RPC first (bypasses RLS)
  const { data, error } = await supabase.rpc('join_league_by_code', {
    invite_code: inviteCode,
    user_id: profileId,
  })
  if (!error && data) {
    const result = data as { error?: string } & Partial<League>
    if (result.error) throw new Error(result.error)
    if (result.id) return result as League
  }

  // Fallback: manual join (relies on RLS policies allowing it)
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()
  if (!league) throw new Error('Invalid invite code')
  const l = league as League

  const { error: insertError } = await supabase
    .from('league_members')
    .insert({ league_id: l.id, profile_id: profileId, team_name: 'My Team', team_color: '#3388ff' })
  if (insertError) {
    if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
      throw new Error('Already a member of this league')
    }
    throw insertError
  }

  return l
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const { data } = await supabase.from('leagues').select('*').eq('id', leagueId).single()
  return data as League | null
}

export async function getLeagueByInviteCode(code: string): Promise<League | null> {
  const { data } = await supabase.from('leagues').select('*').eq('invite_code', code).maybeSingle()
  return data as League | null
}

export async function getLeagueMembers(leagueId: string): Promise<(LeagueMember & { profile: { username: string; display_name: string } })[]> {
  const { data } = await supabase
    .from('league_members')
    .select('*, profile:profiles!inner(username, display_name)')
    .eq('league_id', leagueId)
  return (data ?? []) as any
}

export async function getUserLeagues(profileId: string): Promise<(League & { member: LeagueMember })[]> {
  const { data } = await supabase
    .from('league_members')
    .select('*, league:leagues!inner(*)')
    .eq('profile_id', profileId)
  if (!data) return []
  return (data as any[]).map(d => ({ ...d.league, member: d }))
}

export async function updateLeagueStatus(leagueId: string, status: League['status']): Promise<void> {
  await supabase.from('leagues').update({ status }).eq('id', leagueId)
}

export async function updateMemberTeam(memberId: string, teamName: string, teamColor: string): Promise<void> {
  await supabase.from('league_members').update({ team_name: teamName, team_color: teamColor }).eq('id', memberId)
}
