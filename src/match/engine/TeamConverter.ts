import { TeamData, TeamSide, Position } from '../types'
import { Club } from '../../league/types'
import { getTeamManager, applyManagerBonus } from '../../league/data/managers'

export function clubToTeamData(club: Club, side: TeamSide): TeamData {
  const manager = club.manager ?? getTeamManager(club.name)
  const players = club.players.map((p, i) => ({
    id: `${side}-${i}`,
    name: p.name,
    number: p.number,
    position: p.position,
    team: side,
    attrs: applyManagerBonus(manager, { ...p.attrs }),
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
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    color: club.color,
    side,
    players,
    formation: club.formation,
  }
}
