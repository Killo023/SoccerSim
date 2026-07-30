export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface League {
  id: string
  name: string
  owner_id: string
  invite_code: string
  status: 'draft' | 'drafting' | 'active' | 'finished'
  league_type: string
  replaced_teams: number
  current_week: number
  created_at: string
}

export interface LeagueMember {
  id: string
  league_id: string
  profile_id: string
  team_name: string
  team_color: string
  draft_completed: boolean
  ready: boolean
  joined_at: string
}

export interface DraftPick {
  id: string
  league_id: string
  member_id: string
  player_name: string
  player_club: string
  position: string
  attributes: Record<string, number>
  pick_round: number
  pick_order: number
  created_at: string
}

export interface MatchRecord {
  id: string
  league_id: string
  week_number: number
  home_member_id: string | null
  away_member_id: string | null
  home_team_name: string
  away_team_name: string
  home_goals: number
  away_goals: number
  home_shots: number
  away_shots: number
  home_shots_on_target: number
  away_shots_on_target: number
  home_possession: number
  status: 'pending' | 'playing' | 'finished'
  commentary: string | null
  played_at: string | null
  created_at: string
}
