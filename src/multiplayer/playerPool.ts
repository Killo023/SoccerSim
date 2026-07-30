import { ClubPlayerDef } from '../league/types'
import { Position, PlayerAttrs } from '../match/types'
import { LEAGUES } from '../league/data/clubs'

export interface DraftPlayer {
  name: string
  number: number
  position: Position
  attrs: PlayerAttrs
  clubId: string
  clubName: string
  clubShortName: string
  clubColor: string
  leagueName: string
  overall: number
}

let cachedPool: DraftPlayer[] | null = null

function computeOverall(attrs: PlayerAttrs): number {
  return Math.round((attrs.pace + attrs.shooting + attrs.passing + attrs.dribbling + attrs.defending + attrs.physical) / 6)
}

export function getAllRealPlayers(): DraftPlayer[] {
  if (cachedPool) return cachedPool

  const pool: DraftPlayer[] = []

  for (const league of LEAGUES) {
    for (const club of league.clubs) {
      for (const player of club.players) {
        pool.push({
          name: player.name,
          number: player.number,
          position: player.position,
          attrs: { ...player.attrs },
          clubId: club.id,
          clubName: club.name,
          clubShortName: club.shortName,
          clubColor: club.color,
          leagueName: league.name,
          overall: computeOverall(player.attrs),
        })
      }
    }
  }

  cachedPool = pool
  return pool
}

export function getPlayersForPosition(position: Position, count: number, excludeNames: string[]): DraftPlayer[] {
  const pool = getAllRealPlayers()
  const mapped = POSITION_MAP[position] ?? position
  const filtered = pool.filter(p => p.position === mapped && !excludeNames.includes(p.name))
  const shuffled = [...filtered].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

const POSITION_MAP: Partial<Record<Position, Position>> = {
  LM: 'LW',
  RM: 'RW',
  CAM: 'CM',
}

export function getPlayersForPositionFromTeam(position: Position, clubId: string): DraftPlayer[] {
  const pool = getAllRealPlayers()
  return pool.filter(p => p.position === position && p.clubId === clubId)
}

export function getClubPlayerPool(clubId: string): DraftPlayer[] {
  const pool = getAllRealPlayers()
  return pool.filter(p => p.clubId === clubId)
}

export function getRandomClubs(count: number, excludeIds: string[]): { id: string; name: string; shortName: string; color: string }[] {
  const clubs = LEAGUES.flatMap(l => l.clubs.map(c => ({
    id: c.id, name: c.name, shortName: c.shortName, color: c.color,
  })))
  const available = clubs.filter(c => !excludeIds.includes(c.id))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}