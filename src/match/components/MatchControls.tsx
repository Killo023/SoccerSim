import { useMatchStore } from '../../store/matchStore'
import { SPEED_OPTIONS } from '../constants'

export function MatchControls() {
  const engineRef = useMatchStore(s => s.engineRef)
  const matchState = useMatchStore(s => s.matchState)
  const isJumpedIn = useMatchStore(s => s.isJumpedIn)

  if (!matchState) return null
  const engine = engineRef?.current
  if (!engine) return null

  const status = matchState.status
  const speed = matchState.speed

  return (
    <div className="match-controls">
      <button
        className="ctrl-btn"
        onClick={() => engine.togglePause()}
        title={status === 'playing' ? 'Pause' : 'Play'}
      >
        {status === 'playing' ? '⏸' : status === 'finished' ? '⬜' : '▶'}
      </button>

      <div className="speed-controls">
        <span className="speed-label">Speed:</span>
        {SPEED_OPTIONS.map(s => (
          <button
            key={s}
            className={`ctrl-btn speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => engine.setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="jump-controls">
        <span className="jump-label">
          {isJumpedIn ? '🔵 Controlling a player' : '⚪ Simulating'}
        </span>
        {isJumpedIn && (
          <button
            className="ctrl-btn jump-btn"
            onClick={() => {
              engine.jumpOut()
              useMatchStore.getState().setJumpedIn(false)
            }}
          >
            Jump Out
          </button>
        )}
      </div>

      {matchState.status === 'finished' && (
        <button
          className="ctrl-btn restart-btn"
          onClick={() => window.location.reload()}
        >
          New Match
        </button>
      )}
    </div>
  )
}
