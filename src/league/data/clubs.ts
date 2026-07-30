import { Club } from '../types'
import { PREMIER_LEAGUE_TEAMS } from './premierLeague'
import { LA_LIGA_TEAMS } from './laLiga'
import { CHAMPIONS_LEAGUE_TEAMS } from './championsLeague'
import {
  SAUDI_TEAMS,
  UAE_TEAMS,
  QATAR_TEAMS,
} from './arabLeagues'

export interface LeagueDefinition {
  id: string
  name: string
  shortName: string
  clubs: Club[]
  tier: number
  region: string
}

export const LEAGUES: LeagueDefinition[] = [
  {
    id: 'premier-league',
    name: 'Premier League',
    shortName: 'EPL',
    clubs: PREMIER_LEAGUE_TEAMS,
    tier: 1,
    region: 'England',
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    shortName: 'LALIGA',
    clubs: LA_LIGA_TEAMS,
    tier: 1,
    region: 'Spain',
  },
  {
    id: 'champions-league',
    name: 'Champions League',
    shortName: 'UCL',
    clubs: CHAMPIONS_LEAGUE_TEAMS,
    tier: 1,
    region: 'Europe',
  },
  {
    id: 'saudi-league',
    name: 'Saudi Pro League',
    shortName: 'SPL',
    clubs: SAUDI_TEAMS,
    tier: 1,
    region: 'Saudi Arabia',
  },
  {
    id: 'uae-league',
    name: 'UAE Pro League',
    shortName: 'UAEPL',
    clubs: UAE_TEAMS,
    tier: 1,
    region: 'UAE',
  },
  {
    id: 'qatar-league',
    name: 'Qatar Stars League',
    shortName: 'QSL',
    clubs: QATAR_TEAMS,
    tier: 1,
    region: 'Qatar',
  },
]

export const DEFAULT_LEAGUE_ID = 'premier-league'
export const ALL_CLUBS = LEAGUES.flatMap(l => l.clubs)

export function getLeague(id: string): LeagueDefinition | undefined {
  return LEAGUES.find(l => l.id === id)
}

export function getLeagueClubs(id: string): Club[] {
  return getLeague(id)?.clubs ?? []
}
