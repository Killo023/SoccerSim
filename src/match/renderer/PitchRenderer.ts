import { PITCH_LENGTH, PITCH_WIDTH } from '../constants'

export class PitchRenderer {
  private ctx: CanvasRenderingContext2D
  private w: number
  private h: number
  private scale: number
  private offsetX: number
  private offsetY: number
  private shadowCanvas: HTMLCanvasElement | null = null

  constructor(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) {
    this.ctx = ctx
    this.w = canvasW
    this.h = canvasH
    const padX = 40
    const padY = 40
    const scaleX = (canvasW - padX * 2) / PITCH_WIDTH
    const scaleY = (canvasH - padY * 2) / PITCH_LENGTH
    this.scale = Math.min(scaleX, scaleY)
    this.offsetX = (canvasW - PITCH_WIDTH * this.scale) / 2
    this.offsetY = (canvasH - PITCH_LENGTH * this.scale) / 2
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.offsetX + wx * this.scale,
      y: this.offsetY + wy * this.scale,
    }
  }

  getScale(): number {
    return this.scale
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(x + 2, y + 2, w, h)
  }

  draw() {
    const ctx = this.ctx
    const s = this.scale
    const ox = this.offsetX
    const oy = this.offsetY
    const pw = PITCH_WIDTH * s
    const ph = PITCH_LENGTH * s

    const grad = ctx.createLinearGradient(ox, oy, ox, oy + ph)
    grad.addColorStop(0, '#2a7d3c')
    grad.addColorStop(0.5, '#2d7d3a')
    grad.addColorStop(1, '#2a7d3c')
    ctx.fillStyle = grad
    ctx.fillRect(ox, oy, pw, ph)

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    for (let y = oy + ph * 0.1; y < oy + ph; y += ph * 0.05) {
      ctx.beginPath()
      ctx.moveTo(ox, y)
      ctx.lineTo(ox + pw, y)
      ctx.stroke()
    }

    this.drawShadow(ctx, ox, oy, pw, ph)

    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.5

    ctx.strokeRect(ox, oy, pw, ph)

    const cx = ox + pw / 2
    const cy = oy + ph / 2
    ctx.beginPath()
    ctx.arc(cx, cy, 9.15 * s, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx, oy)
    ctx.lineTo(cx, oy + ph)
    ctx.stroke()

    const paW = 40.32 * s
    const paH = 16.5 * s
    const paX = ox + (pw - paW) / 2

    ctx.strokeRect(paX, oy, paW, paH)
    ctx.strokeRect(paX, oy + ph - paH, paW, paH)

    const gaW = 18.32 * s
    const gaH = 5.5 * s
    const gaX = ox + (pw - gaW) / 2
    ctx.strokeRect(gaX, oy, gaW, gaH)
    ctx.strokeRect(gaX, oy + ph - gaH, gaW, gaH)

    for (const y of [oy + ph - 11 * s, oy + 11 * s]) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(cx, y, 0.5 * s, 0, Math.PI * 2)
      ctx.fill()
    }

    const arcR = 9.15 * s
    ctx.beginPath()
    ctx.arc(cx, oy + ph - 11 * s, arcR, Math.PI * 0.35, Math.PI * 0.65)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, oy + 11 * s, arcR, Math.PI * 1.35, Math.PI * 1.65)
    ctx.stroke()

    const cornerR = 1 * s
    const corners = [[ox, oy], [ox + pw, oy], [ox, oy + ph], [ox + pw, oy + ph]]
    const cornerAngles = [
      [0, Math.PI / 2], [Math.PI / 2, Math.PI],
      [Math.PI * 1.5, Math.PI * 2], [Math.PI, Math.PI * 1.5],
    ]
    corners.forEach(([cx2, cy2], i) => {
      ctx.beginPath()
      ctx.arc(cx2, cy2, cornerR, cornerAngles[i][0] as number, cornerAngles[i][1] as number)
      ctx.stroke()
    })

    const gW = 7.32 * s
    const gH = 2.44 * s
    const gX = ox + (pw - gW) / 2

    const goalGradTop = ctx.createLinearGradient(gX, oy - gH, gX, oy)
    goalGradTop.addColorStop(0, '#ccc')
    goalGradTop.addColorStop(1, '#888')
    ctx.fillStyle = goalGradTop
    ctx.fillRect(gX, oy - gH, gW, gH)

    const goalGradBot = ctx.createLinearGradient(gX, oy + ph, gX, oy + ph + gH)
    goalGradBot.addColorStop(0, '#888')
    goalGradBot.addColorStop(1, '#ccc')
    ctx.fillStyle = goalGradBot
    ctx.fillRect(gX, oy + ph, gW, gH)

    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(gX, oy - gH, gW, gH)
    ctx.strokeRect(gX, oy + ph, gW, gH)

    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(gX, oy - gH, gW, gH)
    ctx.fillRect(gX, oy + ph, gW, gH)
  }
}
