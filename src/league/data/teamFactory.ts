import { Club, ClubPlayerDef } from '../types'
import { Position, PlayerAttrs } from '../../match/types'
import { generateName } from './namePools'

interface StarPlayer {
  name: string
  number: number
  position: Position
  rating: number
}

interface TeamConfig {
  id: string
  name: string
  shortName: string
  color: string
  nationality: string
  stars: StarPlayer[]
  formation?: Position[]
  overall?: number
}

/** A single real player entry for the full-squad builder. */
export interface SquadPlayerDef {
  name: string
  /** One or more positions the player can play, primary first (e.g. ['CB','LB']). */
  positions: string[]
  rating: number
  nationality: string
  playstyle: string
}

export interface SquadTeamConfig {
  id: string
  name: string
  shortName: string
  color: string
  overall: number
  squad: SquadPlayerDef[]
}

const POSITIONS: Position[] = ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW']
const POSITION_WEIGHTS: Record<Position, { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number }> = {
  GK: { pace: 0.2, shooting: 0.1, passing: 0.5, dribbling: 0.2, defending: 0.9, physical: 0.7 },
  CB: { pace: 0.5, shooting: 0.2, passing: 0.5, dribbling: 0.3, defending: 0.9, physical: 0.8 },
  LB: { pace: 0.7, shooting: 0.3, passing: 0.6, dribbling: 0.6, defending: 0.7, physical: 0.6 },
  RB: { pace: 0.7, shooting: 0.3, passing: 0.6, dribbling: 0.6, defending: 0.7, physical: 0.6 },
  CDM: { pace: 0.5, shooting: 0.4, passing: 0.7, dribbling: 0.6, defending: 0.8, physical: 0.8 },
  CM: { pace: 0.5, shooting: 0.5, passing: 0.8, dribbling: 0.7, defending: 0.6, physical: 0.6 },
  CAM: { pace: 0.6, shooting: 0.6, passing: 0.8, dribbling: 0.8, defending: 0.4, physical: 0.5 },
  LM: { pace: 0.7, shooting: 0.5, passing: 0.7, dribbling: 0.7, defending: 0.4, physical: 0.5 },
  RM: { pace: 0.7, shooting: 0.5, passing: 0.7, dribbling: 0.7, defending: 0.4, physical: 0.5 },
  LW: { pace: 0.8, shooting: 0.6, passing: 0.6, dribbling: 0.8, defending: 0.2, physical: 0.4 },
  RW: { pace: 0.8, shooting: 0.6, passing: 0.6, dribbling: 0.8, defending: 0.2, physical: 0.4 },
  ST: { pace: 0.7, shooting: 0.9, passing: 0.5, dribbling: 0.7, defending: 0.1, physical: 0.7 },
}

const POSITION_ALIASES: Record<string, Position> = {
  LWB: 'LB',
  RWB: 'RB',
}

function normalizePosition(s: string): Position {
  const t = s.trim().toUpperCase() as Position
  return POSITION_ALIASES[t] ?? t
}

function generateAttrs(rating: number, position: Position) {
  const base = rating * 0.8
  const variance = 15
  const w = POSITION_WEIGHTS[position]
  return {
    pace: Math.round(Math.min(99, base + w.pace * variance + Math.random() * 8 - 4)),
    shooting: Math.round(Math.min(99, base + w.shooting * variance + Math.random() * 8 - 4)),
    passing: Math.round(Math.min(99, base + w.passing * variance + Math.random() * 8 - 4)),
    dribbling: Math.round(Math.min(99, base + w.dribbling * variance + Math.random() * 8 - 4)),
    defending: Math.round(Math.min(99, base + w.defending * variance + Math.random() * 8 - 4)),
    physical: Math.round(Math.min(99, base + w.physical * variance + Math.random() * 8 - 4)),
  }
}

function generateClubPlayer(number: number, position: Position, rating: number, nationality: string): ClubPlayerDef {
  return {
    name: generateName(nationality),
    number,
    position,
    attrs: generateAttrs(rating, position),
  }
}

export function createTeam(config: TeamConfig): Club {
  const players: ClubPlayerDef[] = []
  const usedNumbers = new Set<number>()

  const starMap = new Map<string, StarPlayer>()
  for (const star of config.stars) {
    starMap.set(star.position, star)
    usedNumbers.add(star.number)
  }

  const formation = config.formation ?? POSITIONS

  for (const pos of formation) {
    const star = starMap.get(pos)
    if (star) {
      players.push({
        name: star.name,
        number: star.number,
        position: star.position,
        attrs: generateAttrs(star.rating, star.position),
      })
    } else {
      let num = players.length + 1
      while (usedNumbers.has(num)) num++
      usedNumbers.add(num)
      const baseRating = config.overall ?? 75
      const rating = baseRating + Math.floor(Math.random() * 8 - 3)
      players.push(generateClubPlayer(num, pos, Math.min(99, Math.max(50, rating)), config.nationality))
    }
  }

  return {
    id: config.id,
    name: config.name,
    shortName: config.shortName,
    color: config.color,
    overall: config.overall,
    players,
    formation,
  }
}

/* ------------------------------------------------------------------ *
 * Full-squad builder (real players with ratings / nationality /      *
 * playstyle). The match engine fields exactly 11 players, so the     *
 * best starting XI is selected from the full squad per formation.    *
 * Attributes are generated deterministically (seeded from the player *
 * name) so both online-league clients build identical teams.         *
 * ------------------------------------------------------------------ */

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateSquadAttrs(rating: number, position: Position, seedStr: string): PlayerAttrs {
  const w = POSITION_WEIGHTS[position]
  const mean = (w.pace + w.shooting + w.passing + w.dribbling + w.defending + w.physical) / 6
  const rand = mulberry32(hashString(seedStr))
  const clamp = (v: number) => Math.max(40, Math.min(99, Math.round(v)))
  const spread = 0.6
  return {
    pace: clamp(rating * (1 + (w.pace - mean) * spread) + rand() * 4 - 2),
    shooting: clamp(rating * (1 + (w.shooting - mean) * spread) + rand() * 4 - 2),
    passing: clamp(rating * (1 + (w.passing - mean) * spread) + rand() * 4 - 2),
    dribbling: clamp(rating * (1 + (w.dribbling - mean) * spread) + rand() * 4 - 2),
    defending: clamp(rating * (1 + (w.defending - mean) * spread) + rand() * 4 - 2),
    physical: clamp(rating * (1 + (w.physical - mean) * spread) + rand() * 4 - 2),
  }
}

const NUMBER_BY_POSITION: Record<Position, number[]> = {
  GK: [1, 13, 25, 31],
  RB: [2, 22, 27, 32],
  CB: [4, 5, 15, 26, 35],
  LB: [3, 33, 20, 28],
  CDM: [6, 16, 25],
  CM: [8, 18, 28],
  CAM: [10, 20, 21, 27],
  LM: [11, 17, 21],
  RM: [7, 19, 23],
  LW: [11, 17, 24],
  RW: [7, 19, 27],
  ST: [9, 14, 18, 23],
}

function assignNumber(position: Position, used: Set<number>): number {
  const pool = NUMBER_BY_POSITION[position] ?? []
  for (const n of pool) {
    if (!used.has(n)) { used.add(n); return n }
  }
  let n = 40
  while (used.has(n)) n++
  used.add(n)
  return n
}

/**
 * Picks the best XI for the default formation. For each slot, the
 * highest-rated unused player who can play that position is chosen;
 * a fallback takes the highest-rated remaining player if no match.
 */
function selectBestXI(
  entries: { def: ClubPlayerDef; positions: Position[]; rating: number }[],
  formation: Position[]
): ClubPlayerDef[] {
  const unused = new Set(entries.map((_, i) => i))
  const result: ClubPlayerDef[] = []

  for (const slot of formation) {
    let best: number | null = null
    let bestRating = -1
    for (const idx of unused) {
      const e = entries[idx]
      if (e.positions.includes(slot) && e.rating > bestRating) {
        bestRating = e.rating
        best = idx
      }
    }
    if (best === null) {
      bestRating = -1
      for (const idx of unused) {
        if (entries[idx].rating > bestRating) { bestRating = entries[idx].rating; best = idx }
      }
    }
    if (best !== null) {
      const def = entries[best].def
      result.push({ ...def, position: slot })
      unused.delete(best)
    }
  }
  return result
}

export function createSquadTeam(config: SquadTeamConfig): Club {
  const usedNumbers = new Set<number>()
  const entries = config.squad.map(p => {
    const positions = p.positions.map(normalizePosition)
    const primary = positions[0]
    return {
      def: {
        name: p.name,
        number: assignNumber(primary, usedNumbers),
        position: primary,
        attrs: generateSquadAttrs(p.rating, primary, p.name),
        nationality: p.nationality,
        playstyle: p.playstyle,
        rating: p.rating,
      },
      positions,
      rating: p.rating,
    }
  })

  const formation = POSITIONS
  const players = selectBestXI(entries, formation)

  return {
    id: config.id,
    name: config.name,
    shortName: config.shortName,
    color: config.color,
    overall: config.overall,
    players,
    formation,
    squad: entries.map(e => e.def),
  }
}

export const DEFAULT_FORMATION = POSITIONS
