import { useEffect } from 'react'
import { MatchView } from './MatchView'
import { MatchControls } from './MatchControls'
import { MatchEndOverlay } from './MatchEndOverlay'
import { StatsPanel } from './StatsPanel'
import { EventFeed } from './EventFeed'
import { useMatchStore } from '../../store/matchStore'

export function MatchScreen() {
  const engineRef = useMatchStore(s => s.engineRef)
  const isJumpedIn = useMatchStore(s => s.isJumpedIn)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef?.current
      if (!engine) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          engine.togglePause()
          break
        case 'Equal':
        case 'NumpadAdd':
          engine.setSpeed(engine.getState().speed + 1)
          break
        case 'Minus':
        case 'NumpadSubtract':
          engine.setSpeed(Math.max(0.5, engine.getState().speed - 1))
          break
        case 'KeyJ':
          if (engine.getState().jumpInPlayerId) {
            engine.jumpOut()
            useMatchStore.getState().setJumpedIn(false)
          }
          break
      }

      if (isJumpedIn) {
        const step = 0.1
        switch (e.code) {
          case 'KeyW': case 'ArrowUp':
            engine.moveControlledPlayer(0, -1)
            break
          case 'KeyS': case 'ArrowDown':
            engine.moveControlledPlayer(0, 1)
            break
          case 'KeyA': case 'ArrowLeft':
            engine.moveControlledPlayer(-1, 0)
            break
          case 'KeyD': case 'ArrowRight':
            engine.moveControlledPlayer(1, 0)
            break
          case 'KeyE':
            engine.passBall()
            break
          case 'KeyQ':
            engine.shootBall()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [engineRef, isJumpedIn])

  return (
    <div className="match-screen">
      <div className="match-main">
        <div className="match-canvas-container">
          <MatchView />
          <MatchEndOverlay />
        </div>
        <div className="match-sidebar">
          <StatsPanel />
          <EventFeed />
          <div className="keybinds">
            <h4>Controls</h4>
            <p><kbd>Space</kbd> Play/Pause</p>
            <p><kbd>+</kbd><kbd>-</kbd> Speed</p>
            <p><kbd>Click</kbd> Select player</p>
            {isJumpedIn && (
              <>
                <p><kbd>WASD</kbd> Move</p>
                <p><kbd>E</kbd> Pass</p>
                <p><kbd>Q</kbd> Shoot</p>
                <p><kbd>J</kbd> Jump Out</p>
              </>
            )}
          </div>
        </div>
      </div>
      <MatchControls />
    </div>
  )
}
