import { useEffect, useRef, useCallback } from 'react'
import { MatchEngine } from '../engine/MatchEngine'
import { MatchRenderer } from '../renderer/MatchRenderer'
import { useMatchStore } from '../../store/matchStore'
import { TeamData } from '../types'
import { HOME_TEAM, AWAY_TEAM } from '../data/teams'

interface MatchViewProps {
  homeTeam?: TeamData
  awayTeam?: TeamData
}

export function MatchView({ homeTeam = HOME_TEAM, awayTeam = AWAY_TEAM }: MatchViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<MatchEngine | null>(null)
  const rendererRef = useRef<MatchRenderer | null>(null)
  const setEngineRef = useMatchStore(s => s.setEngineRef)
  const setMatchState = useMatchStore(s => s.setMatchState)
  const setJumpedIn = useMatchStore(s => s.setJumpedIn)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new MatchRenderer(canvas)
    rendererRef.current = renderer

    const engine = new MatchEngine({
      homeTeam,
      awayTeam,
      onStateUpdate: (state) => {
        renderer.render(state)
        setMatchState({ ...state })
      },
    })
    engineRef.current = engine
    setEngineRef({ current: engine })
    engine.start()

    const handleResize = () => {
      if (canvas) renderer.resize(canvas)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      engine.destroy()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const state = engine.getState()
    const pitchR = (rendererRef.current as any)?.pitchRenderer
    if (!pitchR) return

    let closestId: string | null = null
    let closestDist = Infinity
    state.players.forEach(p => {
      const pos = pitchR.toScreen(p.x, p.y)
      const dx = mx - pos.x
      const dy = my - pos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 20 && d < closestDist) {
        closestId = p.id
        closestDist = d
      }
    })

    if (closestId) {
      if (engine.getState().jumpInPlayerId === closestId) {
        engine.jumpOut()
        setJumpedIn(false)
      } else {
        if (engine.getState().jumpInPlayerId) {
          engine.jumpOut()
        }
        engine.jumpIn(closestId)
        setJumpedIn(true)
      }
    } else if (engine.getState().jumpInPlayerId) {
      engine.jumpOut()
      setJumpedIn(false)
    }
  }, [setJumpedIn])

  return (
    <canvas
      ref={canvasRef}
      className="match-canvas"
      onClick={handleCanvasClick}
      tabIndex={0}
    />
  )
}
