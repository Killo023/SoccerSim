import { TeamData, TeamSide, Position } from '../types'

interface PlayerDef {
  name: string
  number: number
  position: Position
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

function createTeam(
  id: string,
  name: string,
  shortName: string,
  color: string,
  side: TeamSide,
  formation: Position[],
  playerDefs: PlayerDef[]
): TeamData {
  const players = playerDefs.map((p, i) => ({
    id: `${side}-${i}`,
    name: p.name,
    number: p.number,
    position: p.position,
    team: side,
    attrs: {
      pace: p.pace,
      shooting: p.shooting,
      passing: p.passing,
      dribbling: p.dribbling,
      defending: p.defending,
      physical: p.physical,
    },
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    hasBall: false,
    isControlled: false,
    _dx: 0,
    _dy: 0,
    _vx: 0,
    _vy: 0,
  }))
  return { id, name, shortName, color, side, players, formation }
}

const redDefs: PlayerDef[] = [
  { name: 'A. Becker', number: 1, position: 'GK', pace: 45, shooting: 20, passing: 65, dribbling: 30, defending: 80, physical: 75 },
  { name: 'T. Alexander', number: 2, position: 'RB', pace: 78, shooting: 55, passing: 70, dribbling: 68, defending: 72, physical: 70 },
  { name: 'V. Dijk', number: 4, position: 'CB', pace: 65, shooting: 50, passing: 68, dribbling: 60, defending: 88, physical: 85 },
  { name: 'J. Gomez', number: 5, position: 'CB', pace: 72, shooting: 40, passing: 65, dribbling: 58, defending: 82, physical: 78 },
  { name: 'A. Robertson', number: 3, position: 'LB', pace: 80, shooting: 52, passing: 75, dribbling: 70, defending: 75, physical: 72 },
  { name: 'J. Henderson', number: 14, position: 'CM', pace: 62, shooting: 65, passing: 78, dribbling: 68, defending: 72, physical: 80 },
  { name: 'Fabinho', number: 3, position: 'CDM', pace: 60, shooting: 58, passing: 74, dribbling: 65, defending: 82, physical: 82 },
  { name: 'T. Alcantara', number: 6, position: 'CM', pace: 58, shooting: 62, passing: 85, dribbling: 80, defending: 60, physical: 65 },
  { name: 'M. Salah', number: 11, position: 'RW', pace: 90, shooting: 85, passing: 75, dribbling: 88, defending: 35, physical: 70 },
  { name: 'R. Firmino', number: 9, position: 'ST', pace: 68, shooting: 80, passing: 80, dribbling: 82, defending: 40, physical: 75 },
  { name: 'S. Mane', number: 10, position: 'LW', pace: 92, shooting: 82, passing: 72, dribbling: 86, defending: 38, physical: 72 },
]

const blueDefs: PlayerDef[] = [
  { name: 'E. Moraes', number: 31, position: 'GK', pace: 40, shooting: 18, passing: 60, dribbling: 28, defending: 78, physical: 78 },
  { name: 'K. Walker', number: 2, position: 'RB', pace: 88, shooting: 52, passing: 72, dribbling: 68, defending: 74, physical: 74 },
  { name: 'R. Dias', number: 3, position: 'CB', pace: 62, shooting: 45, passing: 66, dribbling: 55, defending: 86, physical: 82 },
  { name: 'J. Stones', number: 5, position: 'CB', pace: 68, shooting: 42, passing: 70, dribbling: 62, defending: 82, physical: 76 },
  { name: 'J. Cancelo', number: 7, position: 'LB', pace: 82, shooting: 58, passing: 76, dribbling: 78, defending: 72, physical: 70 },
  { name: 'K. De Bruyne', number: 17, position: 'CAM', pace: 72, shooting: 82, passing: 92, dribbling: 84, defending: 55, physical: 72 },
  { name: 'Rodri', number: 16, position: 'CDM', pace: 55, shooting: 60, passing: 78, dribbling: 68, defending: 80, physical: 84 },
  { name: 'I. Gundogan', number: 8, position: 'CM', pace: 62, shooting: 72, passing: 82, dribbling: 76, defending: 62, physical: 68 },
  { name: 'R. Sterling', number: 7, position: 'LW', pace: 90, shooting: 78, passing: 72, dribbling: 86, defending: 30, physical: 62 },
  { name: 'S. Aguero', number: 10, position: 'ST', pace: 74, shooting: 90, passing: 74, dribbling: 82, defending: 25, physical: 68 },
  { name: 'P. Foden', number: 47, position: 'RW', pace: 84, shooting: 74, passing: 78, dribbling: 85, defending: 42, physical: 62 },
]

export const HOME_TEAM: TeamData = createTeam('red', 'Red FC', 'RED', '#e74c3c', 'home', ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CM', 'RW', 'ST', 'LW'], redDefs)
export const AWAY_TEAM: TeamData = createTeam('blue', 'Blue City', 'BLU', '#3498db', 'away', ['GK', 'RB', 'CB', 'CB', 'LB', 'CAM', 'CDM', 'CM', 'LW', 'ST', 'RW'], blueDefs)
