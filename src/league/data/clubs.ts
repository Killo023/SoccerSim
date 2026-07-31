import { Club } from '../types'
import { PREMIER_LEAGUE_TEAMS } from './premierLeague'
import { LA_LIGA_TEAMS } from './laLiga'
import { CHAMPIONS_LEAGUE_TEAMS } from './championsLeague'
import { CHAMPIONSHIP_TEAMS } from './championship'
import {
  SAUDI_TEAMS,
  UAE_TEAMS,
  QATAR_TEAMS,
} from './arabLeagues'
import { getTeamManager } from './managers'

export interface LeagueDefinition {
  id: string
  name: string
  shortName: string
  clubs: Club[]
  tier: number
  region: string
}

/** Attaches the club's manager (real where known, deterministic default otherwise). */
function attachManagers(clubs: Club[]): Club[] {
  return clubs.map(c => ({
    ...c,
    manager: getTeamManager(c.name),
  }))
}

export const LEAGUES: LeagueDefinition[] = [
  {
    id: 'premier-league',
    name: 'Premier League',
    shortName: 'EPL',
    clubs: attachManagers(PREMIER_LEAGUE_TEAMS),
    tier: 1,
    region: 'England',
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    shortName: 'LALIGA',
    clubs: attachManagers(LA_LIGA_TEAMS),
    tier: 1,
    region: 'Spain',
  },
  {
    id: 'championship',
    name: 'Championship',
    shortName: 'CHAMP',
    clubs: attachManagers(CHAMPIONSHIP_TEAMS),
    tier: 2,
    region: 'England',
  },
  {
    id: 'champions-league',
    name: 'Champions League',
    shortName: 'UCL',
    clubs: attachManagers(CHAMPIONS_LEAGUE_TEAMS),
    tier: 1,
    region: 'Europe',
  },
  {
    id: 'saudi-league',
    name: 'Saudi Pro League',
    shortName: 'SPL',
    clubs: attachManagers(SAUDI_TEAMS),
    tier: 1,
    region: 'Saudi Arabia',
  },
  {
    id: 'uae-league',
    name: 'UAE Pro League',
    shortName: 'UAEPL',
    clubs: attachManagers(UAE_TEAMS),
    tier: 1,
    region: 'UAE',
  },
  {
    id: 'qatar-league',
    name: 'Qatar Stars League',
    shortName: 'QSL',
    clubs: attachManagers(QATAR_TEAMS),
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
