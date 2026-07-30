import { MatchState } from '../types'
import { PitchRenderer } from './PitchRenderer'
import { PlayerRenderer } from './PlayerRenderer'
import { BallRenderer } from './BallRenderer'

export class MatchRenderer {
  private ctx: CanvasRenderingContext2D
  private w: number
  private h: number
  private pitchRenderer: PitchRenderer | null = null
  private playerRenderer: PlayerRenderer | null = null
  private ballRenderer: BallRenderer | null = null

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    this.ctx = canvas.getContext('2d')!
    this.w = canvas.width
    this.h = canvas.height
  }

  render(state: MatchState) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, this.w, this.h)

    if (!this.pitchRenderer) {
      this.pitchRenderer = new PitchRenderer(ctx, this.w, this.h)
    }
    if (!this.playerRenderer) {
      this.playerRenderer = new PlayerRenderer(ctx)
    }
    if (!this.ballRenderer) {
      this.ballRenderer = new BallRenderer(ctx)
    }

    this.pitchRenderer.draw()
    this.playerRenderer.draw(state.players, state.ball, this.pitchRenderer)
    this.ballRenderer.draw(state.ball, this.pitchRenderer)

    this.drawScoreboard(state)
    this.drawClock(state)
  }

  private drawScoreboard(state: MatchState) {
    const ctx = this.ctx
    const { homeGoals, awayGoals } = state.stats

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    const sbW = 260
    const sbH = 40
    const sbX = (this.w - sbW) / 2
    const sbY = 10
    ctx.beginPath()
    ctx.roundRect(sbX, sbY, sbW, sbH, 8)
    ctx.fill()

    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(sbX + 4, sbY + 4, 40, sbH - 8)
    ctx.fillStyle = '#3498db'
    ctx.fillRect(sbX + sbW - 44, sbY + 4, 40, sbH - 8)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('HOME', sbX + 24, sbY + sbH / 2)
    ctx.fillText('AWAY', sbX + sbW - 24, sbY + sbH / 2)

    ctx.font = 'bold 20px monospace'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(`${homeGoals} - ${awayGoals}`, sbX + sbW / 2, sbY + sbH / 2)
  }

  private drawClock(state: MatchState) {
    const ctx = this.ctx
    const minute = state.matchMinute
    const clockStr = `${minute}'`

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(this.w - 90, 10, 80, 30, 8)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(clockStr, this.w - 50, 25)

    const statusDot = state.status === 'playing' ? '#2ecc71' : state.status === 'paused' ? '#f1c40f' : '#e74c3c'
    ctx.beginPath()
    ctx.arc(this.w - 82, 25, 4, 0, Math.PI * 2)
    ctx.fillStyle = statusDot
    ctx.fill()
  }

  resize(canvas: HTMLCanvasElement) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    this.w = canvas.width
    this.h = canvas.height
    this.pitchRenderer = new PitchRenderer(this.ctx, this.w, this.h)
  }
}
