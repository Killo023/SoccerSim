import { TeamData, MatchState, TeamSide } from '../types'
import { FixtureResult } from '../../league/types'
import { PITCH_WIDTH, PITCH_LENGTH, GOAL_WIDTH, PHYSICS_DT, AI_THINK_INTERVAL, MATCH_DURATION, HALF_TIME } from '../constants'
import { updateBallPosition, distance, kickBall, isInPenaltyArea } from './BallPhysics'
import { runPlayerAI, movePlayer, processTouches } from './PlayerAI'
import { resetBallAfterGoal, resetBallAfterOutOfPlay, checkShot } from './MatchEvents'

function createSimState(homeTeam: TeamData, awayTeam: TeamData): MatchState {
  const homePlayers = homeTeam.players.map(p => ({ ...p, x: 0, y: 0, targetX: 0, targetY: 0, hasBall: false, isControlled: false, _dx: 0, _dy: 0, _vx: 0, _vy: 0 }))
  const awayPlayers = awayTeam.players.map(p => ({ ...p, x: 0, y: 0, targetX: 0, targetY: 0, hasBall: false, isControlled: false, _dx: 0, _dy: 0, _vx: 0, _vy: 0 }))
  const homePositions = [
    { x: PITCH_WIDTH / 2, y: PITCH_LENGTH - 3 }, { x: 12, y: 80 }, { x: 35, y: 84 }, { x: 65, y: 84 }, { x: 88, y: 80 },
    { x: 10, y: 58 }, { x: 35, y: 55 }, { x: 65, y: 55 }, { x: 90, y: 58 }, { x: 35, y: 25 }, { x: 65, y: 25 },
  ]
  const awayPositions = [
    { x: PITCH_WIDTH / 2, y: 3 }, { x: 12, y: 20 }, { x: 35, y: 16 }, { x: 65, y: 16 }, { x: 88, y: 20 },
    { x: 10, y: 42 }, { x: 35, y: 45 }, { x: 65, y: 45 }, { x: 90, y: 42 }, { x: 35, y: 75 }, { x: 65, y: 75 },
  ]
  homePlayers.forEach((p, i) => { const pos = homePositions[i] ?? { x: PITCH_WIDTH / 2, y: PITCH_LENGTH - 10 }; p.x = pos.x; p.y = pos.y; p.targetX = pos.x; p.targetY = pos.y })
  awayPlayers.forEach((p, i) => { const pos = awayPositions[i] ?? { x: PITCH_WIDTH / 2, y: 10 }; p.x = pos.x; p.y = pos.y; p.targetX = pos.x; p.targetY = pos.y })
  return {
    status: 'playing', clock: MATCH_DURATION, speed: 1,
    ball: { x: PITCH_WIDTH / 2, y: PITCH_LENGTH / 2, vx: 0, vy: 0, lastTouchedBy: null, lastTouchedTeam: null },
    players: [...homePlayers, ...awayPlayers], events: [],
    stats: { homePossession: 50, homeShots: 0, homeShotsOnTarget: 0, awayShots: 0, awayShotsOnTarget: 0, homeGoals: 0, awayGoals: 0 },
    jumpInPlayerId: null, matchMinute: 0, isFirstHalf: true,
  }
}

export function fastSimulate(homeTeam: TeamData, awayTeam: TeamData): FixtureResult {
  const state = createSimState(homeTeam, awayTeam)
  const aiTimers = new Map<string, number>()
  let aiThinkTimer = 0
  let cooldownTimer = 0
  const maxIterations = 600000
  let iter = 0

  while (state.clock > 0 && iter < maxIterations) {
    iter++
    const dt = PHYSICS_DT * 2

    state.clock -= dt
    state.matchMinute = Math.max(0, Math.round(90 - state.clock + 0.5))

    if (cooldownTimer > 0) {
      cooldownTimer -= dt
      state.players.forEach(p => movePlayer(p, dt))
      continue
    }

    processTouches(state.players, state.ball)

    aiThinkTimer += dt
    if (aiThinkTimer >= AI_THINK_INTERVAL) {
      aiThinkTimer = 0
      for (const player of state.players) {
        runPlayerAI(player, state.ball, state.players, player.team, AI_THINK_INTERVAL, aiTimers, state.clock, state.stats, state.events)
      }
    }

    state.players.forEach(p => movePlayer(p, dt))

    const carrier = state.players.find(p => p.hasBall)
    if (carrier) {
      const goalY = carrier.team === 'home' ? 0 : PITCH_LENGTH
      const goal = { x: PITCH_WIDTH / 2, y: goalY }
      const dGoal = distance(carrier, goal)
      if (dGoal < 30 && isInPenaltyArea(carrier, carrier.team === 'home') && Math.random() < 0.15) {
        kickBall(state.ball, state.ball, { x: goal.x + (Math.random() - 0.5) * 3, y: goal.y + (Math.random() - 0.5) * 2 }, 26)
        carrier.hasBall = false
        checkShot(state.ball, carrier, state.clock, state.stats)
      } else {
        const ahead = { x: carrier.x + (goal.x - carrier.x) * 0.3, y: carrier.y + (goal.y - carrier.y) * 0.3 }
        kickBall(state.ball, state.ball, ahead, 4 + (carrier.attrs.dribbling / 100) * 4)
      }
    }

    updateBallPosition(state.ball, dt)

    const inGoalX = state.ball.x > (PITCH_WIDTH - GOAL_WIDTH) / 2 && state.ball.x < (PITCH_WIDTH + GOAL_WIDTH) / 2
    if (state.ball.y < -1 && inGoalX) {
      state.stats.homeGoals++
      resetBallAfterGoal(state.ball)
      cooldownTimer = 3
      continue
    }
    if (state.ball.y > PITCH_LENGTH + 1 && inGoalX) {
      state.stats.awayGoals++
      resetBallAfterGoal(state.ball)
      cooldownTimer = 3
      continue
    }
    if (state.ball.y < -2 || state.ball.y > PITCH_LENGTH + 2 || state.ball.x < -2 || state.ball.x > PITCH_WIDTH + 2) {
      const lastTouched = state.ball.lastTouchedTeam
      const outY = state.ball.y < -2 || state.ball.y > PITCH_LENGTH + 2
      if (outY && !inGoalX) {
        const attacking: TeamSide = state.ball.y < 0 ? 'home' : 'away'
        const type = lastTouched === attacking ? 'goal_kick' : 'corner'
        resetBallAfterOutOfPlay(state.ball, type, lastTouched)
        cooldownTimer = 2
      } else if (!outY && (state.ball.x < -2 || state.ball.x > PITCH_WIDTH + 2)) {
        resetBallAfterOutOfPlay(state.ball, 'throw_in', lastTouched)
        cooldownTimer = 2
      }
    }

    const ballOwner = state.players.find(p => p.hasBall)
    if (ballOwner) {
      state.stats.homePossession = Math.max(0, Math.min(100, state.stats.homePossession + (ballOwner.team === 'home' ? 0.05 : -0.05)))
    }
  }

  return {
    homeGoals: state.stats.homeGoals,
    awayGoals: state.stats.awayGoals,
    homeShots: state.stats.homeShots,
    awayShots: state.stats.awayShots,
    homeShotsOnTarget: state.stats.homeShotsOnTarget,
    awayShotsOnTarget: state.stats.awayShotsOnTarget,
    homePossession: Math.round(state.stats.homePossession),
  }
}