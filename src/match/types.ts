export interface Vec2 {
  x: number
  y: number
}

export type TeamSide = 'home' | 'away'
export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST'
export type MatchStatus = 'paused' | 'playing' | 'finished'
export type MatchEventType = 'goal' | 'own_goal' | 'shot' | 'shot_off_target' | 'save' | 'pass' | 'foul' | 'corner' | 'goal_kick' | 'throw_in' | 'half_time' | 'full_time'

export interface PlayerAttrs {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

export interface Player {
  id: string
  name: string
  number: number
  position: Position
  team: TeamSide
  attrs: PlayerAttrs
  x: number
  y: number
  targetX: number
  targetY: number
  hasBall: boolean
  isControlled: boolean
  _dx: number
  _dy: number
  _vx: number
  _vy: number
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  lastTouchedBy: string | null
  lastTouchedTeam: TeamSide | null
}

export interface Goal {
  x: number
  y: number
  width: number
  height: number
  side: TeamSide
}

export interface TeamData {
  id: string
  name: string
  shortName: string
  color: string
  side: TeamSide
  players: Player[]
  formation: Position[]
}

export interface MatchEvent {
  id: string
  type: MatchEventType
  minute: number
  team: TeamSide
  playerId?: string
  x: number
  y: number
  description: string
}

export interface MatchStats {
  homePossession: number
  homeShots: number
  homeShotsOnTarget: number
  awayShots: number
  awayShotsOnTarget: number
  homeGoals: number
  awayGoals: number
}

export interface MatchState {
  status: MatchStatus
  clock: number
  speed: number
  ball: Ball
  players: Player[]
  events: MatchEvent[]
  stats: MatchStats
  jumpInPlayerId: string | null
  matchMinute: number
  isFirstHalf: boolean
}

export interface FormationPosition {
  position: Position
  x: number
  y: number
}

export const FORMATIONS: Record<string, FormationPosition[]> = {
  '4-4-2': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'LB', x: 15, y: 80 },
    { position: 'CB', x: 38, y: 82 },
    { position: 'CB', x: 62, y: 82 },
    { position: 'RB', x: 85, y: 80 },
    { position: 'LM', x: 10, y: 55 },
    { position: 'CM', x: 35, y: 55 },
    { position: 'CM', x: 65, y: 55 },
    { position: 'RM', x: 90, y: 55 },
    { position: 'ST', x: 35, y: 25 },
    { position: 'ST', x: 65, y: 25 },
  ],
  '4-3-3': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'LB', x: 15, y: 80 },
    { position: 'CB', x: 38, y: 82 },
    { position: 'CB', x: 62, y: 82 },
    { position: 'RB', x: 85, y: 80 },
    { position: 'CM', x: 30, y: 52 },
    { position: 'CM', x: 50, y: 55 },
    { position: 'CM', x: 70, y: 52 },
    { position: 'LW', x: 15, y: 25 },
    { position: 'ST', x: 50, y: 20 },
    { position: 'RW', x: 85, y: 25 },
  ],
  '4-2-3-1': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'LB', x: 15, y: 80 },
    { position: 'CB', x: 38, y: 82 },
    { position: 'CB', x: 62, y: 82 },
    { position: 'RB', x: 85, y: 80 },
    { position: 'CDM', x: 30, y: 60 },
    { position: 'CDM', x: 70, y: 60 },
    { position: 'CAM', x: 50, y: 42 },
    { position: 'LW', x: 15, y: 25 },
    { position: 'ST', x: 50, y: 18 },
    { position: 'RW', x: 85, y: 25 },
  ],
  '3-5-2': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'CB', x: 25, y: 82 },
    { position: 'CB', x: 50, y: 84 },
    { position: 'CB', x: 75, y: 82 },
    { position: 'LM', x: 5, y: 55 },
    { position: 'CM', x: 35, y: 55 },
    { position: 'CM', x: 50, y: 52 },
    { position: 'CM', x: 65, y: 55 },
    { position: 'RM', x: 95, y: 55 },
    { position: 'ST', x: 40, y: 22 },
    { position: 'ST', x: 60, y: 22 },
  ],
  '4-3-2-1': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'LB', x: 15, y: 80 },
    { position: 'CB', x: 38, y: 82 },
    { position: 'CB', x: 62, y: 82 },
    { position: 'RB', x: 85, y: 80 },
    { position: 'CM', x: 30, y: 55 },
    { position: 'CM', x: 50, y: 55 },
    { position: 'CM', x: 70, y: 55 },
    { position: 'CAM', x: 38, y: 38 },
    { position: 'CAM', x: 62, y: 38 },
    { position: 'ST', x: 50, y: 18 },
  ],
}
