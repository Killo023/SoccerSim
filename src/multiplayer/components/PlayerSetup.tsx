import { useState } from 'react'
import { useMultiplayerStore } from '../store'
import { TEAM_COLORS } from '../types'

export function PlayerSetup() {
  const players = useMultiplayerStore(s => s.players)
  const addPlayer = useMultiplayerStore(s => s.addPlayer)
  const removePlayer = useMultiplayerStore(s => s.removePlayer)
  const setPhase = useMultiplayerStore(s => s.setPhase)
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TEAM_COLORS[0])
  const [error, setError] = useState('')

  const usedColors = players.map(p => p.color)

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a name'); return }
    if (players.length >= 6) { setError('Max 6 players'); return }
    if (usedColors.includes(selectedColor)) { setError('Color already taken'); return }
    addPlayer(trimmed, selectedColor)
    setName('')
    setError('')
    const remaining = TEAM_COLORS.find(c => ![...usedColors, selectedColor].includes(c))
    if (remaining) setSelectedColor(remaining)
  }

  const handleStart = () => {
    if (players.length < 2) { setError('Need at least 2 players'); return }
    setPhase('creating')
  }

  return (
    <div className="mp-setup">
      <div className="mp-setup-card">
        <h1 className="mp-title">Friends League</h1>
        <p className="mp-subtitle">Add your friends to start the session</p>

        <div className="mp-add-row">
          <input
            className="mp-input"
            placeholder="Player name..."
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            maxLength={20}
          />
          <div className="mp-color-picker">
            {TEAM_COLORS.map(c => (
              <button
                key={c}
                className={`mp-color-swatch ${selectedColor === c ? 'active' : ''} ${usedColors.includes(c) ? 'taken' : ''}`}
                style={{ background: c }}
                onClick={() => { setSelectedColor(c); setError('') }}
                disabled={usedColors.includes(c)}
              />
            ))}
          </div>
          <button className="mp-btn mp-btn-primary" onClick={handleAdd}>Add</button>
        </div>

        {error && <p className="mp-error">{error}</p>}

        <div className="mp-player-list">
          {players.map(p => (
            <div key={p.id} className="mp-player-row">
              <span className="mp-player-dot" style={{ background: p.color }} />
              <span className="mp-player-name">{p.name}</span>
              <button className="mp-btn-remove" onClick={() => removePlayer(p.id)}>✕</button>
            </div>
          ))}
          {players.length === 0 && <p className="mp-empty">No players yet. Add at least 2.</p>}
        </div>

        <button
          className="mp-btn mp-btn-primary mp-btn-full"
          onClick={handleStart}
          disabled={players.length < 2}
        >
          Start Team Creation ({players.length} players)
        </button>
      </div>
    </div>
  )
}