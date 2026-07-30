import { v4 as uuid } from 'uuid'
import { MatchState, TeamData, Player, MatchStats, TeamSide, Ball } from '../types'
import {
  PITCH_LENGTH, PITCH_WIDTH, PHYSICS_DT, AI_THINK_INTERVAL, HALF_TIME, GOAL_WIDTH
} from '../constants'
import { updateBallPosition, distance, kickBall } from './BallPhysics'
import { runPlayerAI, movePlayer, processTouches, getPlayerSpeed, getFormationPos } from './PlayerAI'
import { rng } from '../rng'
import { checkGoal, checkShot, resetBallAfterGoal, resetBallAfterOutOfPlay } from './MatchEvents'

interface MatchConfig {
  homeTeam: TeamData
  awayTeam: TeamData
  onStateUpdate: (state: MatchState) => void
}

function createInitialBall(side: TeamSide): Ball {
  return { x: PITCH_WIDTH / 2, y: PITCH_LENGTH / 2, vx: 0, vy: 0, lastTouchedBy: null, lastTouchedTeam: side }
}

function createInitialStats(): MatchStats {
  return { homePossession: 50, homeShots: 0, homeShotsOnTarget: 0, awayShots: 0, awayShotsOnTarget: 0, homeGoals: 0, awayGoals: 0 }
}

function cloneTeamPlayers(team: TeamData): Player[] {
  return team.players.map((p, i) => {
    const pos = getFormationPos(i, team.side)
    return { ...p, x: pos.x, y: pos.y, targetX: pos.x, targetY: pos.y, hasBall: false, isControlled: false }
  })
}

export class MatchEngine {
  private state: MatchState
  private onStateUpdate: (state: MatchState) => void
  private animFrameId: number | null = null
  private accumulator = 0
  private lastTime = 0
  private aiTimers = new Map<string, number>()
  private aiThinkTimer = 0
  private kickoffTimer = 0
  private possessionTimer = 0
  private possessionTeam: TeamSide | null = null
  private cooldownTimer = 0
  private cooldownReason: 'goal' | 'out' | null = null
  private started = false

  constructor(config: MatchConfig) {
    this.onStateUpdate = config.onStateUpdate
    const players = [
      ...cloneTeamPlayers(config.homeTeam),
      ...cloneTeamPlayers(config.awayTeam),
    ]
    const side = 'home'
    const ball = createInitialBall(side)
    this.state = {
      status: 'playing',
      clock: HALF_TIME,
      speed: 1,
      ball,
      players,
      events: [],
      stats: createInitialStats(),
      jumpInPlayerId: null,
      matchMinute: 0,
      isFirstHalf: true,
    }
    this.state.events.push({
      id: uuid(), type: 'goal_kick', minute: 0, team: side, x: ball.x, y: ball.y,
      description: 'Kickoff!',
    })
  }

  start() {
    if (this.started) return
    this.started = true
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  destroy() {
    this.started = false
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId)
  }

  private loop = (time: number) => {
    if (!this.started) return
    let dt = (time - this.lastTime) / 1000
    this.lastTime = time
    dt = Math.min(dt, 0.05)
    this.accumulator += dt * this.state.speed

    while (this.accumulator >= PHYSICS_DT) {
      this.update(PHYSICS_DT)
      this.accumulator -= PHYSICS_DT
    }

    this.onStateUpdate(this.state)
    this.animFrameId = requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    if (this.state.status === 'finished') return

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt
      if (this.cooldownReason === 'goal' && dt > 0) {
        for (const player of this.state.players) {
          if (player.isControlled) continue
          const teamPlayers = this.state.players.filter(p => p.team === player.team)
          const formationIx = teamPlayers.findIndex(p => p.id === player.id)
          const fp = getFormationPos(Math.max(0, formationIx), player.team)
          const dx = fp.x - player.x; const dy = fp.y - player.y
          const dist = Math.hypot(dx, dy)
          if (dist < 0.5) continue
          const speed = getPlayerSpeed(player); const step = Math.min(speed * dt, dist)
          player.x += (dx / dist) * step; player.y += (dy / dist) * step
        }
      }
      if (this.cooldownTimer <= 0) {
        this.cooldownTimer = 0
        if (this.cooldownReason === 'out') {
          const restartTeam = this.state.ball.lastTouchedTeam
          const nearest = this.state.players
            .filter(p => p.team === restartTeam && p.position !== 'GK')
            .sort((a, b) => distance(a, this.state.ball) - distance(b, this.state.ball))[0]
          if (nearest) {
            nearest.x = this.state.ball.x; nearest.y = this.state.ball.y
            nearest.hasBall = true
            this.state.ball.lastTouchedBy = nearest.id
          }
        }
        this.cooldownReason = null
      }
      return
    }

    this.state.clock -= dt
    const elapsed = HALF_TIME - this.state.clock
    this.state.matchMinute = Math.max(0, Math.min(90, Math.round(elapsed) + (this.state.isFirstHalf ? 0 : HALF_TIME)))

    if (this.state.clock <= 0) {
      if (this.state.isFirstHalf) {
        this.state.clock = HALF_TIME
        this.state.isFirstHalf = false
        this.resetBallForKickoff()
        this.state.status = 'playing'
        return
      }
      this.state.status = 'finished'
      this.state.matchMinute = 90
      this.state.events.push({
        id: uuid(), type: 'full_time', minute: 90, team: 'home', x: 0, y: 0,
        description: 'Full time!',
      })
      return
    }

    processTouches(this.state.players, this.state.ball)

    this.aiThinkTimer += dt
    if (this.aiThinkTimer >= AI_THINK_INTERVAL) {
      this.aiThinkTimer = 0
      for (const player of this.state.players) {
        runPlayerAI(player, this.state.ball, this.state.players, player.team, AI_THINK_INTERVAL, this.aiTimers, this.state.clock, this.state.stats, this.state.events)
      }
    }

    for (const player of this.state.players) {
      if (player.isControlled) {
        const speed = getPlayerSpeed(player)
        const targetVx = player._dx * speed
        const targetVy = player._dy * speed
        const accel = speed * 3
        const friction = Math.pow(0.85, dt * 60)
        player._vx = (player._vx + (targetVx - player._vx) * accel * dt) * friction
        player._vy = (player._vy + (targetVy - player._vy) * accel * dt) * friction
        player.x += player._vx * dt
        player.y += player._vy * dt
        player.x = Math.max(1, Math.min(PITCH_WIDTH - 1, player.x))
        player.y = Math.max(1, Math.min(PITCH_LENGTH - 1, player.y))
        if (player.hasBall) {
          this.state.ball.x = player.x
          this.state.ball.y = player.y
          this.state.ball.vx = 0
          this.state.ball.vy = 0
          this.state.ball.lastTouchedTeam = player.team
          this.state.ball.lastTouchedBy = player.id
        }
        continue
      }
      movePlayer(player, dt)
    }

    updateBallPosition(this.state.ball, dt)

    const inGoalX = this.state.ball.x > (PITCH_WIDTH - GOAL_WIDTH) / 2 && this.state.ball.x < (PITCH_WIDTH + GOAL_WIDTH) / 2

    if (this.state.ball.y < -1 && inGoalX) {
      const lastPlayer = this.state.players.find(p => p.id === this.state.ball.lastTouchedBy)
      const isOwnGoal = lastPlayer && lastPlayer.team === 'away'
      this.state.stats.homeGoals++
      if (isOwnGoal) {
        this.state.events.push({
          id: uuid(), type: 'own_goal', minute: this.state.matchMinute, team: 'home',
          playerId: lastPlayer?.id, x: this.state.ball.x, y: this.state.ball.y,
          description: `OWN GOAL! ${lastPlayer?.name ?? 'Unknown'} puts it into his own net! (${this.state.stats.homeGoals}-${this.state.stats.awayGoals})`,
        })
      } else {
        this.state.events.push({
          id: uuid(), type: 'goal', minute: this.state.matchMinute, team: 'home',
          playerId: lastPlayer?.id, x: this.state.ball.x, y: this.state.ball.y,
          description: `GOAL! ${lastPlayer?.name ?? 'Unknown'} scores! (${this.state.stats.homeGoals}-${this.state.stats.awayGoals})`,
        })
      }
      resetBallAfterGoal(this.state.ball)
      this.cooldownTimer = 2; this.cooldownReason = 'goal'
      this.state.ball.lastTouchedTeam = 'away'
      return
    }
    if (this.state.ball.y > PITCH_LENGTH + 1 && inGoalX) {
      const lastPlayer = this.state.players.find(p => p.id === this.state.ball.lastTouchedBy)
      const isOwnGoal = lastPlayer && lastPlayer.team === 'home'
      this.state.stats.awayGoals++
      if (isOwnGoal) {
        this.state.events.push({
          id: uuid(), type: 'own_goal', minute: this.state.matchMinute, team: 'away',
          playerId: lastPlayer?.id, x: this.state.ball.x, y: this.state.ball.y,
          description: `OWN GOAL! ${lastPlayer?.name ?? 'Unknown'} puts it into his own net! (${this.state.stats.homeGoals}-${this.state.stats.awayGoals})`,
        })
      } else {
        this.state.events.push({
          id: uuid(), type: 'goal', minute: this.state.matchMinute, team: 'away',
          playerId: lastPlayer?.id, x: this.state.ball.x, y: this.state.ball.y,
          description: `GOAL! ${lastPlayer?.name ?? 'Unknown'} scores! (${this.state.stats.homeGoals}-${this.state.stats.awayGoals})`,
        })
      }
      resetBallAfterGoal(this.state.ball)
      this.cooldownTimer = 2; this.cooldownReason = 'goal'
      this.state.ball.lastTouchedTeam = 'home'
      return
    }

    if (this.state.ball.y < -2 || this.state.ball.y > PITCH_LENGTH + 2 || this.state.ball.x < -2 || this.state.ball.x > PITCH_WIDTH + 2) {
      const lastTouched = this.state.ball.lastTouchedTeam
      const outY = this.state.ball.y < -2 || this.state.ball.y > PITCH_LENGTH + 2
      if (outY && !inGoalX) {
        const attacking: TeamSide = this.state.ball.y < 0 ? 'home' : 'away'
        const type = lastTouched === attacking ? 'goal_kick' : 'corner'
        const taking: TeamSide = type === 'goal_kick' ? (lastTouched === 'home' ? 'away' : 'home') : lastTouched!
        resetBallAfterOutOfPlay(this.state.ball, type, lastTouched)
        this.state.events.push({
          id: uuid(), type, minute: this.state.matchMinute, team: taking,
          x: this.state.ball.x, y: this.state.ball.y,
          description: type === 'goal_kick' ? 'Goal kick.' : 'Corner!',
        })
        this.cooldownTimer = 2; this.cooldownReason = 'out'
      } else if (!outY && (this.state.ball.x < -2 || this.state.ball.x > PITCH_WIDTH + 2)) {
        const throwTeam: TeamSide = lastTouched === 'home' ? 'away' : 'home'
        resetBallAfterOutOfPlay(this.state.ball, 'throw_in', lastTouched)
        this.state.events.push({
          id: uuid(), type: 'throw_in', minute: this.state.matchMinute, team: throwTeam,
          x: this.state.ball.x, y: this.state.ball.y,
          description: 'Throw-in.',
        })
        this.cooldownTimer = 2; this.cooldownReason = 'out'
      }
    }

    if (this.state.ball.lastTouchedTeam) {
      const p = this.state.stats
      if (this.state.ball.lastTouchedTeam === 'home') p.homePossession = Math.min(100, p.homePossession + 0.3)
      else p.homePossession = Math.max(0, p.homePossession - 0.3)
    }
  }

  private advancePlayersHome(dt: number) {
    for (const player of this.state.players) {
      if (player.isControlled) continue
      const teamPlayers = this.state.players.filter(p => p.team === player.team)
      const formationIx = teamPlayers.findIndex(p => p.id === player.id)
      const fp = getFormationPos(Math.max(0, formationIx), player.team)
      const dx = fp.x - player.x; const dy = fp.y - player.y
      const dist = Math.hypot(dx, dy)
      if (dist < 0.5) continue
      const speed = getPlayerSpeed(player); const step = Math.min(speed * dt, dist)
      player.x += (dx / dist) * step; player.y += (dy / dist) * step
    }
  }

  private resetBallForKickoff() {
    this.state.ball.x = PITCH_WIDTH / 2; this.state.ball.y = PITCH_LENGTH / 2; this.state.ball.vx = 0; this.state.ball.vy = 0
    this.state.ball.lastTouchedBy = null; this.state.ball.lastTouchedTeam = 'home'
  }

  getState(): MatchState { return this.state }

  togglePause() {
    if (this.state.status === 'finished') return
    this.state.status = this.state.status === 'playing' ? 'paused' : 'playing'
    if (this.state.status === 'playing') {
      this.lastTime = performance.now()
    }
  }

  setSpeed(speed: number) {
    this.state.speed = Math.max(0.5, Math.min(8, speed))
  }

  jumpIn(playerId: string) {
    this.state.players.forEach(p => { p.isControlled = false; p._dx = 0; p._dy = 0; p._vx = 0; p._vy = 0 })
    const player = this.state.players.find(p => p.id === playerId)
    if (player) {
      player.isControlled = true
      this.state.jumpInPlayerId = playerId
    }
  }

  jumpOut() {
    this.state.players.forEach(p => { p.isControlled = false; p._dx = 0; p._dy = 0; p._vx = 0; p._vy = 0 })
    this.state.jumpInPlayerId = null
  }

  moveControlledPlayer(dx: number, dy: number) {
    const player = this.state.players.find(p => p.isControlled)
    if (!player) return
    player._dx = dx; player._dy = dy
    if (dx === 0 && dy === 0) return
    const len = Math.hypot(dx, dy)
    player._dx = dx / len; player._dy = dy / len
  }

  passBall() {
    const player = this.state.players.find(p => p.isControlled && p.hasBall)
    if (!player) return
    const teammates = this.state.players.filter(p => p.team === player.team && p.id !== player.id)
    let best: Player | null = null; let bestS = -Infinity
    for (const t of teammates) {
      const d = distance(player, t)
      if (d > 40) continue
      const fwd = player.team === 'home' ? (t.y - player.y) : -(t.y - player.y)
      const s = fwd * 0.5 + (40 - d) * 0.5
      if (s > bestS) { bestS = s; best = t }
    }
    if (!best) return
    const p = distance(player, best)
    const lx = (best.targetX - best.x) * Math.min(p / 22, 1.5) * 0.3
    const ly = (best.targetY - best.y) * Math.min(p / 22, 1.5) * 0.3
    kickBall(this.state.ball, player, { x: best.x + lx, y: best.y + ly }, 22)
    player.hasBall = false
    this.state.ball.lastTouchedBy = player.id; this.state.ball.lastTouchedTeam = player.team
  }

  shootBall() {
    const player = this.state.players.find(p => p.isControlled && p.hasBall)
    if (!player) return
    const goalY = player.team === 'home' ? 0 : PITCH_LENGTH
    const err = (1 - player.attrs.shooting / 100) * 5
    kickBall(this.state.ball, player, { x: PITCH_WIDTH / 2 + (rng() - 0.5) * err, y: goalY + (rng() - 0.5) * 3 }, 28)
    player.hasBall = false
    const evt = checkShot(this.state.ball, player, this.state.clock, this.state.stats)
    this.state.events.push(evt)
    this.state.ball.lastTouchedBy = player.id; this.state.ball.lastTouchedTeam = player.team
  }
}