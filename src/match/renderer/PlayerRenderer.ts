import { Player, Ball } from '../types'
import { PitchRenderer } from './PitchRenderer'

export class PlayerRenderer {
  private ctx: CanvasRenderingContext2D

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }

  draw(players: Player[], ball: Ball, pitch: PitchRenderer) {
    const s = pitch.getScale()
    const ctx = this.ctx

    for (const player of players) {
      const pos = pitch.toScreen(player.x, player.y)
      const r = 6 * (s / 5)
      const isHome = player.team === 'home'
      const color = isHome ? '#e74c3c' : '#3498db'

      const speed = Math.hypot(player._vx, player._vy)
      const moving = speed > 0.3
      let angle = 0
      if (moving) {
        angle = Math.atan2(player._vy, player._vx)
      } else {
        angle = Math.atan2(player.targetY - player.y, player.targetX - player.x)
      }

      ctx.save()
      ctx.translate(pos.x, pos.y)
      ctx.rotate(angle)

      const bodyW = r * 1.4
      const bodyH = r * 1.8

      ctx.beginPath()
      ctx.ellipse(0, 0, bodyW * 0.45, bodyH * 0.55, 0, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = player.hasBall ? '#f1c40f' : player.isControlled ? '#2ecc71' : 'rgba(0,0,0,0.3)'
      ctx.lineWidth = player.hasBall || player.isControlled ? 2.5 : 1
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.max(6, r * 0.75)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(player.number), 0, 0)

      if (player.hasBall) {
        ctx.beginPath()
        ctx.arc(0, -bodyH * 0.3, r * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = '#f1c40f'
        ctx.fill()
      }

      if (moving) {
        const legLength = r * 0.5
        const legW = r * 0.25
        const legSwing = Math.sin(Date.now() * 0.01 + player.x) * 0.3
        ctx.fillStyle = color
        ctx.fillRect(-legW / 2, bodyH * 0.35, legW, legLength * (1 + legSwing))
        ctx.fillRect(-legW / 2, bodyH * 0.35, legW, legLength * (1 - legSwing))
      }

      ctx.restore()

      if (player.isControlled) {
        ctx.strokeStyle = '#2ecc71'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r + 5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }
}