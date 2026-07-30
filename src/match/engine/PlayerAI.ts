import { Player, Ball, Vec2, TeamSide, MatchStats, MatchEvent } from '../types'
import {
  PITCH_LENGTH, PITCH_WIDTH, PLAYER_SPEED, KEEPER_SPEED,
  PASS_DISTANCE_MAX, GOAL_WIDTH, SHOOT_DISTANCE_MAX,
} from '../constants'
import { distance, isInPenaltyArea, kickBall } from './BallPhysics'
import { checkShot } from './MatchEvents'

export function getPlayerSpeed(p: Player): number {
  return p.position === 'GK' ? KEEPER_SPEED : PLAYER_SPEED * (0.7 + 0.3 * p.attrs.pace / 100)
}

export function getFormationPos(i: number, side: TeamSide): Vec2 {
  if (side === 'home') {
    if (i === 0) return { x: PITCH_WIDTH / 2, y: PITCH_LENGTH - 3 }
    const xs = [12, 35, 65, 88, 10, 35, 65, 90, 40, 60]
    const ys = [80, 84, 84, 80, 58, 55, 55, 58, 25, 25]
    return { x: xs[i - 1] ?? 50, y: ys[i - 1] ?? 50 }
  }
  if (i === 0) return { x: PITCH_WIDTH / 2, y: 3 }
  const xs = [88, 65, 35, 12, 90, 65, 35, 10, 60, 40]
  const ys = [20, 16, 16, 20, 42, 45, 45, 42, 75, 75]
  return { x: xs[i - 1] ?? 50, y: ys[i - 1] ?? 50 }
}

function getOpponentGoal(side: TeamSide): Vec2 {
  return { x: PITCH_WIDTH / 2, y: side === 'home' ? 0 : PITCH_LENGTH }
}

function getOwnGoal(side: TeamSide): Vec2 {
  return { x: PITCH_WIDTH / 2, y: side === 'home' ? PITCH_LENGTH : 0 }
}

export function runPlayerAI(
  player: Player,
  ball: Ball,
  allPlayers: Player[],
  side: TeamSide,
  dt: number,
  aiTimers: Map<string, number>,
  clock: number,
  stats: MatchStats,
  events: MatchEvent[]
) {
  const timer = aiTimers.get(player.id) ?? 0
  aiTimers.set(player.id, timer + dt)
  if (timer < 0.15) return
  aiTimers.set(player.id, 0)

  const teamPlayers = allPlayers.filter(p => p.team === side)
  const oppPlayers = allPlayers.filter(p => p.team !== side)
  const formationIx = teamPlayers.findIndex(p => p.id === player.id)
  const ownGoal = getOwnGoal(side)
  const oppGoal = getOpponentGoal(side)
  const hasPossession = ball.lastTouchedTeam === side
  const isGK = player.position === 'GK'
  const isDefender = player.position === 'CB' || player.position === 'LB' || player.position === 'RB' || player.position === 'CDM'
  const isAttacker = player.position === 'LW' || player.position === 'RW' || player.position === 'ST'
  const isMidfielder = !isGK && !isDefender && !isAttacker

  if (!allPlayers.some(p => p.hasBall) && !isGK) {
    const sortedByDist = [...teamPlayers].sort((a, b) => distance(a, ball) - distance(b, ball))
    const idx = sortedByDist.indexOf(player)
    if (idx < 2) {
      player.targetX = ball.x + (Math.random() - 0.5) * 2
      player.targetY = ball.y + (Math.random() - 0.5) * 2
      return
    }
  }

  if (isGK) {
    const gkY = side === 'home' ? PITCH_LENGTH - 3 : 3
    if (player.hasBall) {
      const underPressure = oppPlayers.some(p => distance(p, player) < 5)
      const target = findOpenTeammate(player, teamPlayers, ball, oppGoal, oppPlayers, side)
      if (target && !underPressure) {
        const lead = leadPosition(target)
        const err = (1 - player.attrs.passing / 100) * 4
        kickBall(ball, player, { x: lead.x + (Math.random() - 0.5) * err, y: lead.y + (Math.random() - 0.5) * err }, 30)
      } else {
        const clearX = PITCH_WIDTH / 2 + (Math.random() - 0.5) * 20
        const clearY = side === 'home' ? PITCH_LENGTH * 0.3 : PITCH_LENGTH * 0.7
        kickBall(ball, player, { x: clearX, y: clearY }, 35)
      }
      player.hasBall = false
      return
    }
    const ballInOwnPenalty = side === 'home' ? ball.y > PITCH_LENGTH - 18 : ball.y < 18
    if (ballInOwnPenalty && distance(player, ball) < 20) {
      player.targetX = ball.x; player.targetY = Math.max(3, Math.min(PITCH_LENGTH - 3, ball.y))
    } else {
      player.targetX = PITCH_WIDTH / 2 + (ball.x - PITCH_WIDTH / 2) * 0.25; player.targetY = gkY
    }
    player.x = Math.max(0, Math.min(PITCH_WIDTH, player.x))
    player.y = Math.max(0, Math.min(PITCH_LENGTH, player.y))
    return
  }

  if (hasPossession) {
    if (player.hasBall) {
      const dGoal = distance(player, oppGoal)
      const inBox = isInPenaltyArea(player, side === 'home')

      if (dGoal < SHOOT_DISTANCE_MAX && inBox) {
        const errX = (1 - (player.attrs.shooting + player.attrs.dribbling) / 200) * 4
        const errY = (1 - (player.attrs.shooting + player.attrs.dribbling) / 200) * 2
        kickBall(ball, player, { x: oppGoal.x + (Math.random() - 0.5) * errX, y: oppGoal.y + (Math.random() - 0.5) * errY }, 28)
        player.hasBall = false; player.targetX = oppGoal.x; player.targetY = oppGoal.y
        events.push(checkShot(ball, player, clock, stats))
        return
      }

      if (dGoal < SHOOT_DISTANCE_MAX * 2 && !inBox && !isGK && Math.random() < 0.30) {
        const errX = (1 - player.attrs.shooting / 100) * 8
        const errY = (1 - player.attrs.shooting / 100) * 4
        kickBall(ball, player, { x: oppGoal.x + (Math.random() - 0.5) * errX, y: oppGoal.y + (Math.random() - 0.5) * errY }, 26)
        player.hasBall = false
        events.push(checkShot(ball, player, clock, stats))
        return
      }

      const passTarget = findOpenTeammate(player, teamPlayers, ball, oppGoal, oppPlayers, side)
      if (passTarget && Math.random() < 0.50 + (player.attrs.passing / 100) * 0.35) {
        const lead = leadPosition(passTarget)
        const err = (1 - player.attrs.passing / 100) * 3
        const power = dGoal < SHOOT_DISTANCE_MAX * 1.5 ? 30 : 38
        kickBall(ball, player, { x: lead.x + (Math.random() - 0.5) * err, y: lead.y + (Math.random() - 0.5) * err }, power)
        player.hasBall = false; return
      }

      const aheadX = player.x + (oppGoal.x - player.x) * 0.35
      const aheadY = player.y + (oppGoal.y - player.y) * 0.35
      const dribblePower = 8 + (player.attrs.dribbling / 100) * 12
      kickBall(ball, player, { x: aheadX, y: aheadY }, dribblePower)
      player.hasBall = false; return
    }
    doAttack(player, teamPlayers, ball, oppGoal, side, isDefender, isMidfielder, isAttacker)
    return
  }
  doDefend(player, teamPlayers, oppPlayers, ball, ownGoal, oppGoal, side, isDefender, isMidfielder)
}

function doAttack(
  player: Player,
  teamPlayers: Player[],
  ball: Ball,
  oppGoal: Vec2,
  side: TeamSide,
  isDefender: boolean,
  isMidfielder: boolean,
  isAttacker: boolean
) {
  const isHome = side === 'home'
  const formIdx = teamPlayers.findIndex(p => p.id === player.id)
  const formPos = getFormationPos(Math.max(0, formIdx), side)
  const dxBall = ball.x - player.x
  const dyBall = ball.y - player.y
  const distToBall = Math.hypot(dxBall, dyBall)
  const ballDir = distToBall > 0 ? { x: dxBall / distToBall, y: dyBall / distToBall } : { x: 0, y: 0 }
  const ballInAttackingHalf = isHome ? ball.y < PITCH_LENGTH * 0.55 : ball.y > PITCH_LENGTH * 0.45
  const isWide = player.position === 'LW' || player.position === 'RW' || player.position === 'LB' || player.position === 'RB' || player.position === 'LM' || player.position === 'RM'
  const dir = isHome ? -1 : 1

  const lateralShift = (ball.x - PITCH_WIDTH / 2) * 0.2
  const tx = Math.max(5, Math.min(PITCH_WIDTH - 5, formPos.x + lateralShift + (Math.random() - 0.5) * 2))
  let ty: number

  if (isAttacker || isWide) {
    if (ballInAttackingHalf) {
      ty = formPos.y + dir * 18 + ballDir.y * 4
    } else {
      ty = formPos.y + dir * 5 + ballDir.y * 3
    }
    player.targetX = tx
    player.targetY = Math.max(5, Math.min(PITCH_LENGTH - 5, ty))
    return
  }

  if (isMidfielder) {
    if (ballInAttackingHalf) {
      ty = formPos.y + dir * 25 + ballDir.y * 3
    } else {
      ty = formPos.y + dir * 8 + ballDir.y * 2
    }
    player.targetX = tx
    player.targetY = Math.max(10, Math.min(PITCH_LENGTH - 10, ty))
    return
  }

  if (ballInAttackingHalf) {
    ty = formPos.y + dir * 25 + ballDir.y * 2
  } else {
    ty = formPos.y + dir * 3
  }
  player.targetX = tx
  player.targetY = Math.max(15, Math.min(PITCH_LENGTH - 15, ty))
}

function doDefend(
  player: Player,
  teamPlayers: Player[],
  oppPlayers: Player[],
  ball: Ball,
  ownGoal: Vec2,
  oppGoal: Vec2,
  side: TeamSide,
  isDefender: boolean,
  isMidfielder: boolean
) {
  const isHome = side === 'home'
  const formIdx = teamPlayers.findIndex(p => p.id === player.id)
  const formPos = getFormationPos(Math.max(0, formIdx), side)
  const carrier = oppPlayers.find(p => p.hasBall)
  const sorted = [...teamPlayers].sort((a, b) => distance(a, ball) - distance(b, ball))
  const idx = sorted.indexOf(player)
  const dxBall = ball.x - player.x
  const dyBall = ball.y - player.y
  const distToBall = Math.hypot(dxBall, dyBall)
  const ballDir = distToBall > 0 ? { x: dxBall / distToBall, y: dyBall / distToBall } : { x: 0, y: 1 }

  if (carrier && idx < 3) {
    const dxGoal = ownGoal.x - carrier.x
    const dyGoal = ownGoal.y - carrier.y
    const dGoal = Math.max(Math.hypot(dxGoal, dyGoal), 0.01)
    player.targetX = Math.max(2, Math.min(PITCH_WIDTH - 2, carrier.x + (dxGoal / dGoal) * 3))
    player.targetY = Math.max(2, Math.min(PITCH_LENGTH - 2, carrier.y + (dyGoal / dGoal) * 3))
    return
  }

  if (carrier) {
    const dx = carrier.x - ball.x; const dy = carrier.y - ball.y
    const d = Math.max(Math.hypot(dx, dy), 0.01)
    player.targetX = Math.max(3, Math.min(PITCH_WIDTH - 3, ball.x + (dx / d) * 2 + (Math.random() - 0.5) * 1))
    player.targetY = Math.max(3, Math.min(PITCH_LENGTH - 3, ball.y + (dy / d) * 2 + (Math.random() - 0.5) * 1))
    return
  }

  const lateralShift = (ball.x - PITCH_WIDTH / 2) * 0.2
  const tx = Math.max(3, Math.min(PITCH_WIDTH - 3, formPos.x + lateralShift + (Math.random() - 0.5) * 1))
  let ty: number

  if (isDefender) {
    const lineY = isHome
      ? Math.max(55, Math.min(90, ball.y * 0.5 + 50))
      : Math.max(15, Math.min(50, ball.y * 0.5))
    const baseY = formPos.y + (ownGoal.y - formPos.y) * 0.15
    ty = (isHome ? Math.min(baseY, lineY) : Math.max(baseY, lineY)) + (Math.random() - 0.5) * 1
  } else if (isMidfielder) {
    ty = formPos.y + (isHome ? -2 : 2) + ballDir.y * 2
  } else {
    ty = formPos.y + (isHome ? -2 : 2) + ballDir.y * 2
  }

  player.targetX = tx
  player.targetY = Math.max(3, Math.min(PITCH_LENGTH - 3, ty))
}

function leadPosition(target: Player): Vec2 {
  const lt = Math.min(distance(target, { x: target.targetX, y: target.targetY }) / 22, 1.5)
  return {
    x: target.targetX + (target.targetX - target.x) * lt * 0.3,
    y: target.targetY + (target.targetY - target.y) * lt * 0.3,
  }
}

function findOpenTeammate(passer: Player, teammates: Player[], ball: Ball, oppGoal: Vec2, oppPlayers: Player[], side: TeamSide): Player | null {
  let best: Player | null = null; let bestS = -Infinity
  const passerDistGoal = distance(passer, oppGoal)
  const underPressure = oppPlayers.some(o => distance(o, passer) < 4)

  for (const t of teammates) {
    if (t.position === 'GK' || t.hasBall) continue
    const d = distance(passer, t)
    if (d > PASS_DISTANCE_MAX) continue
    if (distance(t, ball) < 2) continue

    let s = 0
    const tDistGoal = distance(t, oppGoal)
    const oppDist = oppPlayers.reduce((min, o) => Math.min(min, distance(t, o)), Infinity)

    const forwardProgress = passerDistGoal - tDistGoal
    s += Math.max(0, Math.min(3, forwardProgress * 0.1 + 1))

    s += oppDist > 8 ? 4 : oppDist > 5 ? 3 : oppDist > 3 ? 1 : 0

    if (underPressure) {
      s += d < 12 ? 3 : d < 20 ? 2 : 0
    } else {
      s += d < 8 ? 1 : d < 20 ? 2 : 0
    }

    const inDangerZone = (side === 'home' && t.y < PITCH_LENGTH * 0.35) || (side !== 'home' && t.y > PITCH_LENGTH * 0.65)
    if (inDangerZone && oppDist > 4) s += 2

    const wide = Math.abs(t.x - PITCH_WIDTH / 2) > PITCH_WIDTH * 0.25 ? 1 : 0
    s += wide

    s += (passer.attrs.passing / 100) * (1 - d / PASS_DISTANCE_MAX) * 2

    if (s > bestS) { bestS = s; best = t }
  }
  return bestS > 1 ? best : null
}

export function movePlayer(player: Player, dt: number) {
  const dx = player.targetX - player.x; const dy = player.targetY - player.y
  const dist = Math.hypot(dx, dy)
  const maxSpeed = getPlayerSpeed(player)
  const accel = maxSpeed * 3
  const friction = Math.pow(0.85, dt * 60)
  if (dist < 0.5) {
    player._vx *= friction
    player._vy *= friction
    if (Math.hypot(player._vx, player._vy) < 0.05) {
      player._vx = 0; player._vy = 0
    }
    player.x += player._vx * dt
    player.y += player._vy * dt
  } else {
    const tvx = (dx / dist) * maxSpeed
    const tvy = (dy / dist) * maxSpeed
    player._vx = (player._vx + (tvx - player._vx) * accel * dt) * friction
    player._vy = (player._vy + (tvy - player._vy) * accel * dt) * friction
    player.x += player._vx * dt
    player.y += player._vy * dt
  }
  player.x = Math.max(0, Math.min(PITCH_WIDTH, player.x))
  player.y = Math.max(0, Math.min(PITCH_LENGTH, player.y))
}

export function processTouches(players: Player[], ball: Ball) {
  for (const player of players) {
    if (player.isControlled) continue
    if (distance(player, ball) < 1.2) {
      if (!player.hasBall) {
        const prev = players.find(p => p.hasBall)
        if (prev && prev.team !== player.team && distance(player, ball) < 2) {
          prev.hasBall = false
          ball.lastTouchedBy = player.id; ball.lastTouchedTeam = player.team
          const angle = Math.atan2(ball.y - player.y, ball.x - player.x) + (Math.random() - 0.5) * 2
          ball.vx = Math.cos(angle) * 4; ball.vy = Math.sin(angle) * 4
          return
        }
        if (!prev || prev.team === player.team) {
          if (prev && prev.team === player.team) {
            const pd = distance(prev, ball); const nd = distance(player, ball)
            if (nd >= pd - 0.3 && pd <= 3) continue
          }
          player.hasBall = true
          if (prev) prev.hasBall = false
          ball.lastTouchedBy = player.id; ball.lastTouchedTeam = player.team
          const speed = Math.hypot(ball.vx, ball.vy)
          if (player.position === 'GK') {
            ball.vx = 0; ball.vy = 0
          } else if (speed > 5) {
            ball.vx *= 0.3; ball.vy *= 0.3
          }
        }
      }
    }
  }
}

















