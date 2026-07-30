import { Ball, Vec2 } from '../types'
import { BALL_FRICTION, BALL_MAX_SPEED, PITCH_LENGTH, PITCH_WIDTH } from '../constants'

export function updateBallPosition(ball: Ball, dt: number) {
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt
  const friction = Math.pow(BALL_FRICTION, dt * 60)
  ball.vx *= friction
  ball.vy *= friction
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed < 0.1) { ball.vx = 0; ball.vy = 0; return }
  if (speed > BALL_MAX_SPEED) { const s = BALL_MAX_SPEED / speed; ball.vx *= s; ball.vy *= s }
}

export function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y) }

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

export function kickBall(ball: Ball, from: Vec2, to: Vec2, power: number) {
  const dir = normalize({ x: to.x - from.x, y: to.y - from.y })
  ball.vx = dir.x * power; ball.vy = dir.y * power
}

export function isInPenaltyArea(pos: Vec2, isTopHalf: boolean): boolean {
  const t = isTopHalf ? 0 : PITCH_LENGTH - 16.5
  const b = isTopHalf ? 16.5 : PITCH_LENGTH
  const l = (PITCH_WIDTH - 40.32) / 2
  const r = (PITCH_WIDTH + 40.32) / 2
  return pos.x >= l && pos.x <= r && pos.y >= t && pos.y <= b
}