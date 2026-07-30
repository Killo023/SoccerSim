import { Club, ClubPlayerDef } from '../types'
import { Position } from '../../match/types'
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
    players,
    formation,
  }
}

export const DEFAULT_FORMATION = POSITIONS
