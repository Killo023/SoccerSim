import { PlayerAttrs, Position } from '../match/types'

export interface ClubPlayerDef {
  name: string
  number: number
  position: Position
  attrs: PlayerAttrs
  nationality?: string
  playstyle?: string
  rating?: number
}

export interface Club {
  id: string
  name: string
  shortName: string
  color: string
  /** Team overall rating (1-99) from the club database. */
  overall?: number
  /** Starting XI (11 players, ordered for the match engine formation). */
  players: ClubPlayerDef[]
  formation: Position[]
  /** Full squad roster (real players) used by the multiplayer draft pool. */
  squad?: ClubPlayerDef[]
}

export interface FixtureResult {
  homeGoals: number
  awayGoals: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homePossession: number
}

export interface Fixture {
  id: string
  week: number
  homeClubId: string
  awayClubId: string
  result: FixtureResult | null
  played: boolean
}

export interface Standing {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  form: ('W' | 'D' | 'L')[]
}

export interface League {
  id: string
  name: string
  clubs: Club[]
  fixtures: Fixture[]
  standings: Standing[]
  currentWeek: number
  totalWeeks: number
  seasonComplete: boolean
}

export interface CupRound {
  name: string
  matchups: CupMatchup[]
}

export interface CupMatchup {
  homeClubId: string
  awayClubId: string
  result: FixtureResult | null
  played: boolean
  winnerId: string | null
}

export interface Cup {
  id: string
  name: string
  clubs: Club[]
  rounds: CupRound[]
  currentRound: number
  complete: boolean
}
