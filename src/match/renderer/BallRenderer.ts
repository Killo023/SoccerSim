import { Ball } from '../types'
import { PitchRenderer } from './PitchRenderer'

export class BallRenderer {
  private ctx: CanvasRenderingContext2D
  private trail: Array<{ x: number; y: number }> = []

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }

  draw(ball: Ball, pitch: PitchRenderer) {
    const s = pitch.getScale()
    const pos = pitch.toScreen(ball.x, ball.y)
    const r = 3.5 * (s / 5)

    this.trail.push({ x: pos.x, y: pos.y })
    if (this.trail.length > 12) this.trail.shift()

    const speed = Math.hypot(ball.vx, ball.vy)
    const maxTrailLen = Math.min(12, 4 + speed * 0.3)
    while (this.trail.length > maxTrailLen) this.trail.shift()

    const ctx = this.ctx

    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i]
      const alpha = (i / this.trail.length) * 0.3
      const tr = r * (0.5 + 0.5 * (i / this.trail.length))
      ctx.beginPath()
      ctx.arc(t.x, t.y, tr, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200,200,200,${alpha})`
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#f5f5f5'
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.stroke()

    if (speed > 5) {
      const dir = { x: ball.vx / speed, y: ball.vy / speed }
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(pos.x + dir.x * r * 2.5, pos.y + dir.y * r * 2.5)
      ctx.strokeStyle = 'rgba(100,100,100,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
}
