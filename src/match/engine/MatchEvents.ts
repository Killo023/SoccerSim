import { Ball, Player, MatchEvent, TeamSide, MatchStats } from '../types'
import { PITCH_LENGTH, PITCH_WIDTH, GOAL_WIDTH } from '../constants'
import { v4 as uuid } from 'uuid'

export function checkGoal(ball: Ball, players: Player[], clock: number, stats: MatchStats): MatchEvent | null {
  const inGoalY = ball.x >= (PITCH_WIDTH - GOAL_WIDTH) / 2 && ball.x <= (PITCH_WIDTH + GOAL_WIDTH) / 2
  if (ball.y < 0 && inGoalY) {
    const scorer = players.find(p => p.id === ball.lastTouchedBy)
    stats.homeGoals++
    const minute = Math.max(0, Math.min(90, Math.round(90 - clock)))
    return { id: uuid(), type: 'goal', minute, team: 'home', playerId: scorer?.id, x: ball.x, y: ball.y, description: `GOAL! ${scorer?.name ?? 'Unknown'} scores! (${stats.homeGoals}-${stats.awayGoals})` }
  }
  if (ball.y > PITCH_LENGTH && inGoalY) {
    const scorer = players.find(p => p.id === ball.lastTouchedBy)
    stats.awayGoals++
    const minute = Math.max(0, Math.min(90, Math.round(90 - clock)))
    return { id: uuid(), type: 'goal', minute, team: 'away', playerId: scorer?.id, x: ball.x, y: ball.y, description: `GOAL! ${scorer?.name ?? 'Unknown'} scores! (${stats.homeGoals}-${stats.awayGoals})` }
  }
  return null
}

export function checkShot(ball: Ball, shooter: Player, clock: number, stats: MatchStats): MatchEvent {
  const goalY = shooter.team === 'home' ? 0 : PITCH_LENGTH
  const ballSpeed = Math.hypot(ball.vx, ball.vy)
  const vy = ball.vy
  const dy = goalY - ball.y
  let onT = false
  if (vy !== 0 && ballSpeed > 5 && Math.sign(vy) === Math.sign(dy)) {
    const timeToGoal = Math.abs(dy / vy)
    const predX = ball.x + ball.vx * timeToGoal
    const goalLeft = (PITCH_WIDTH - GOAL_WIDTH) / 2
    const goalRight = (PITCH_WIDTH + GOAL_WIDTH) / 2
    onT = predX > goalLeft && predX < goalRight
  }
  if (shooter.team === 'home') { stats.homeShots++; if (onT) stats.homeShotsOnTarget++ }
  else { stats.awayShots++; if (onT) stats.awayShotsOnTarget++ }
  const minute = Math.max(0, Math.min(90, Math.round(90 - clock)))
  return { id: uuid(), type: onT ? 'shot' : 'shot_off_target', minute, team: shooter.team, playerId: shooter.id, x: ball.x, y: ball.y, description: `${shooter.name} ${onT ? 'shoots on target' : 'shoots wide'}!` }
}

export function resetBallAfterGoal(ball: Ball) {
  ball.x = PITCH_WIDTH / 2; ball.y = PITCH_LENGTH / 2; ball.vx = 0; ball.vy = 0; ball.lastTouchedBy = null; ball.lastTouchedTeam = null
}

export function resetBallAfterOutOfPlay(ball: Ball, type: 'goal_kick' | 'corner' | 'throw_in', lastTouchedTeam: TeamSide | null) {
  ball.vx = 0; ball.vy = 0; ball.lastTouchedBy = null
  if (type === 'goal_kick') {
    ball.x = PITCH_WIDTH / 2
    ball.y = ball.y <= PITCH_LENGTH / 2 ? 6 : PITCH_LENGTH - 6
    ball.lastTouchedTeam = lastTouchedTeam === 'home' ? 'away' : 'home'
  } else if (type === 'corner') {
    ball.x = ball.x <= PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH
    ball.y = ball.y <= PITCH_LENGTH / 2 ? 0 : PITCH_LENGTH
    ball.lastTouchedTeam = lastTouchedTeam
  } else {
    ball.x = ball.x < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH
    ball.y = Math.max(3, Math.min(PITCH_LENGTH - 3, ball.y))
    ball.lastTouchedTeam = lastTouchedTeam === 'home' ? 'away' : 'home'
  }
}