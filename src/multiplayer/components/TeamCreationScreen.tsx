import { useState, useEffect, useCallback } from 'react'
import { useMultiplayerStore } from '../store'
import {
  FORMATION_OPTIONS, FormationName, DraftSlot, TEAM_COLORS,
  DRAFT_OPTIONS_PER_PICK, TEAM_CREATION_SECONDS
} from '../types'
import { FORMATIONS } from '../../match/types'
import { getPlayersForPosition, DraftPlayer } from '../playerPool'
import { draftSlotsToCustomTeam } from '../store'

const POSITION_LABELS: Record<string, string> = {
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', CDM: 'CDM',
  CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM', LW: 'LW', RW: 'RW', ST: 'ST',
}

function createEmptySlots(formation: FormationName): DraftSlot[] {
  return FORMATIONS[formation].map(f => ({
    position: f.position,
    filled: false,
    player: null,
  }))
}

function formatOVR(attrs: { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number }): number {
  return Math.round((attrs.pace + attrs.shooting + attrs.passing + attrs.dribbling + attrs.defending + attrs.physical) / 6)
}

export function TeamCreationScreen() {
  const players = useMultiplayerStore(s => s.players)
  const currentCreatorIndex = useMultiplayerStore(s => s.currentCreatorIndex)
  const setCurrentCreatorIndex = useMultiplayerStore(s => s.setCurrentCreatorIndex)
  const countdown = useMultiplayerStore(s => s.countdown)
  const tickCountdown = useMultiplayerStore(s => s.tickCountdown)
  const setCountdown = useMultiplayerStore(s => s.setCountdown)
  const setPhase = useMultiplayerStore(s => s.setPhase)
  const registerTeam = useMultiplayerStore(s => s.registerTeam)

  const currentPlayer = players[currentCreatorIndex]
  const isLastPlayer = currentCreatorIndex >= players.length - 1

  const [step, setStep] = useState<'details' | 'draft'>('details')
  const [teamName, setTeamName] = useState('')
  const [shortName, setShortName] = useState('')
  const [color, setColor] = useState(TEAM_COLORS[0])
  const [formation, setFormation] = useState<FormationName>('4-4-2')
  const [slots, setSlots] = useState<DraftSlot[]>(() => createEmptySlots('4-4-2'))
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0)
  const [options, setOptions] = useState<DraftPlayer[]>([])
  const [rollsUsed, setRollsUsed] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayer | null>(null)
  const [draftComplete, setDraftComplete] = useState(false)

  const currentSlot = slots[currentSlotIdx]
  const filledCount = slots.filter(s => s.filled).length

  const fetchOptions = useCallback((idx: number) => {
    const slot = slots[idx]
    if (!slot || slot.filled) return
    const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
    const newOptions = getPlayersForPosition(slot.position, DRAFT_OPTIONS_PER_PICK, exclude)
    setOptions(newOptions)
    setRollsUsed(0)
    setSelectedPlayer(null)
  }, [slots])

  useEffect(() => {
    if (step === 'draft' && !draftComplete) {
      const firstUnfilled = slots.findIndex(s => !s.filled)
      if (firstUnfilled >= 0) {
        setCurrentSlotIdx(firstUnfilled)
        fetchOptions(firstUnfilled)
      } else {
        setDraftComplete(true)
      }
    }
  }, [step, draftComplete])

  useEffect(() => {
    setCountdown(TEAM_CREATION_SECONDS)
  }, [currentCreatorIndex])

  useEffect(() => {
    if (countdown <= 0) {
      handleAutoFinish()
      return
    }
    const timer = setInterval(tickCountdown, 1000)
    return () => clearInterval(timer)
  }, [countdown, currentCreatorIndex])

  const handleFormationChange = (f: FormationName) => {
    setFormation(f)
    setSlots(createEmptySlots(f))
    setCurrentSlotIdx(0)
    setDraftComplete(false)
    setSelectedPlayer(null)
    if (step === 'draft') {
      fetchOptions(0)
    }
  }

  const handleRoll = () => {
    const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
    const newOptions = getPlayersForPosition(currentSlot.position, DRAFT_OPTIONS_PER_PICK, exclude)
    setOptions(newOptions)
    setRollsUsed(r => r + 1)
    setSelectedPlayer(null)
  }

  const handlePickPlayer = (player: DraftPlayer) => {
    setSelectedPlayer(player)
  }

  const handleConfirmPick = () => {
    if (!selectedPlayer) return
    const confirmedPlayer = selectedPlayer

    setSlots(prev => {
      const next = [...prev]
      next[currentSlotIdx] = { position: currentSlot.position, filled: true, player: confirmedPlayer }
      return next
    })
    setSelectedPlayer(null)

    const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
    exclude.push(confirmedPlayer.name)

    const nextIdx = slots.findIndex((s, i) => !s.filled && i !== currentSlotIdx)
    if (nextIdx < 0) {
      setDraftComplete(true)
    } else {
      setCurrentSlotIdx(nextIdx)
      const nextPosition = slots[nextIdx].position
      const newOptions = getPlayersForPosition(nextPosition, DRAFT_OPTIONS_PER_PICK, exclude)
      setOptions(newOptions)
      setRollsUsed(0)
    }
  }

  const handleAutoFinish = useCallback(() => {
    const finalSlots = slots.map((slot, i) => {
      if (slot.filled) return slot
      const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
      const autoPick = getPlayersForPosition(slot.position, 1, exclude)
      return {
        position: slot.position,
        filled: true,
        player: autoPick[0] || null,
      }
    })

    const safeName = teamName.trim() || `${currentPlayer.name}'s Team`
    const safeShort = shortName.trim().toUpperCase().slice(0, 4) || safeName.slice(0, 4).toUpperCase()
    const team = draftSlotsToCustomTeam(
      currentPlayer.id, currentPlayer.name, safeName, safeShort, color, formation, finalSlots
    )
    registerTeam(team)
    advanceToNextPlayer(safeName, safeShort)
  }, [slots, teamName, shortName, color, formation, currentPlayer, isLastPlayer])

  const advanceToNextPlayer = (name: string, short: string) => {
    if (isLastPlayer) {
      setPhase('lobby')
    } else {
      setCurrentCreatorIndex(currentCreatorIndex + 1)
      setTeamName('')
      setShortName('')
      setColor(TEAM_COLORS[0])
      setFormation('4-4-2')
      setSlots(createEmptySlots('4-4-2'))
      setCurrentSlotIdx(0)
      setDraftComplete(false)
      setSelectedPlayer(null)
      setStep('details')
    }
  }

  const handleFinishDraft = useCallback(() => {
    const safeName = teamName.trim() || `${currentPlayer.name}'s Team`
    const safeShort = shortName.trim().toUpperCase().slice(0, 4) || safeName.slice(0, 4).toUpperCase()
    const team = draftSlotsToCustomTeam(
      currentPlayer.id, currentPlayer.name, safeName, safeShort, color, formation, slots
    )
    registerTeam(team)
    advanceToNextPlayer(safeName, safeShort)
  }, [slots, teamName, shortName, color, formation, currentPlayer, isLastPlayer])

  if (!currentPlayer) return null

  if (step === 'draft') {
    return (
      <div className="mp-creation">
        <div className="mp-creation-header">
          <div className="mp-creator-info">
            <span className="mp-creator-dot" style={{ background: currentPlayer.color }} />
            <span className="mp-creator-name">{currentPlayer.name}'s Draft</span>
          </div>
          <div className="mp-draft-progress">
            <span className="mp-draft-count">{filledCount}/11</span>
            <div className="mp-draft-track">
              <div className="mp-draft-fill" style={{ width: `${(filledCount / 11) * 100}%` }} />
            </div>
          </div>
          <div className="mp-timer">
            <span className="mp-timer-icon">⏱</span>
            <span className={`mp-timer-value ${countdown <= 15 ? 'urgent' : ''}`}>{countdown}s</span>
          </div>
        </div>

        <div className="mp-draft-body">
          <div className="mp-draft-pitch-col">
            <div className="mp-pitch-detailed">
              <div className="mp-pitch-grass" />
              <div className="mp-pitch-line mp-pitch-boundary" />
              <div className="mp-pitch-line mp-pitch-halfway" />
              <div className="mp-pitch-center-circle" />
              <div className="mp-pitch-center-spot" />
              <div className="mp-pitch-line mp-pitch-penalty-top" />
              <div className="mp-pitch-line mp-pitch-penalty-bot" />
              <div className="mp-pitch-line mp-pitch-goalbox-top" />
              <div className="mp-pitch-line mp-pitch-goalbox-bot" />
              <div className="mp-pitch-goal mp-pitch-goal-top" />
              <div className="mp-pitch-goal mp-pitch-goal-bot" />
              <div className="mp-pitch-pen-spot mp-pitch-pen-spot-top" />
              <div className="mp-pitch-pen-spot mp-pitch-pen-spot-bot" />

              {slots.map((slot, i) => {
                const pos = FORMATIONS[formation][i]
                const isActive = i === currentSlotIdx && !slot.filled
                const isFilled = slot.filled
                const p = slot.player
                return (
                  <div
                    key={i}
                    className={`mp-draft-pitch-player ${isActive ? 'drafting' : ''} ${isFilled ? 'filled' : ''}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    title={p ? `${p.name} (${p.clubShortName}) - ${formatOVR(p.attrs)} OVR` : ''}
                  >
                    <div className="mp-draft-pos-ring">
                      <span className="mp-draft-pos-label">{POSITION_LABELS[slot.position]}</span>
                    </div>
                    {p && (
                      <div className="mp-draft-player-name">{p.name.split(' ').pop()}</div>
                    )}
                    {isActive && <div className="mp-draft-indicator" />}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mp-draft-panel-col">
            {draftComplete ? (
              <div className="mp-draft-complete">
                <h2>Team Complete!</h2>
                <div className="mp-draft-summary">
                  {slots.map((slot, i) => {
                    const p = slot.player!
                    return (
                      <div key={i} className="mp-draft-summary-row">
                        <span className="mp-draft-summary-pos">{POSITION_LABELS[slot.position]}</span>
                        <span className="mp-draft-summary-name">{p.name}</span>
                        <span className="mp-draft-summary-club" style={{ color: p.clubColor }}>{p.clubShortName}</span>
                        <span className="mp-draft-summary-ovr">{formatOVR(p.attrs)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mp-draft-summary-avg">
                  Team Avg: {Math.round(slots.reduce((s, sl) => s + formatOVR(sl.player!.attrs), 0) / 11)} OVR
                </div>
                <button className="mp-btn mp-btn-primary mp-btn-full" onClick={handleFinishDraft}>
                  {isLastPlayer ? 'Lock Team & Start League!' : 'Lock Team & Next Player'}
                </button>
                <button className="mp-btn mp-btn-full" onClick={() => setStep('details')} style={{ marginTop: 8 }}>
                  Back to Team Settings
                </button>
              </div>
            ) : (
              <>
                <div className="mp-draft-pick-header">
                  <span className="mp-draft-pick-pos">Pick #{filledCount + 1}: {POSITION_LABELS[currentSlot.position]}</span>
                  <span className="mp-draft-pick-rolls">
                    <button className="mp-draft-roll-btn" onClick={handleRoll}>
                      ↩ Roll ({rollsUsed + 1})
                    </button>
                  </span>
                </div>

                <div className="mp-draft-options">
                  {options.map((player, i) => {
                    const ovr = formatOVR(player.attrs)
                    const isSelected = selectedPlayer?.name === player.name
                    return (
                      <button
                        key={`${player.name}-${i}`}
                        className={`mp-draft-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handlePickPlayer(player)}
                      >
                        <div className="mp-draft-card-header">
                          <span className="mp-draft-card-pos">{POSITION_LABELS[player.position]}</span>
                          <span className="mp-draft-card-ovr">{ovr}</span>
                        </div>
                        <span className="mp-draft-card-name">{player.name}</span>
                        <div className="mp-draft-card-club">
                          <span className="mp-draft-card-dot" style={{ background: player.clubColor }} />
                          <span>{player.clubShortName}</span>
                        </div>
                        <div className="mp-draft-card-meta">
                          {player.playstyle && <span className="mp-draft-card-playstyle">{player.playstyle}</span>}
                          {player.nationality && <span className="mp-draft-card-nation">{player.nationality}</span>}
                        </div>
                        <div className="mp-draft-card-attrs">
                          <div className="mp-draft-attr"><span>PAC</span><span>{player.attrs.pace}</span></div>
                          <div className="mp-draft-attr"><span>SHO</span><span>{player.attrs.shooting}</span></div>
                          <div className="mp-draft-attr"><span>PAS</span><span>{player.attrs.passing}</span></div>
                          <div className="mp-draft-attr"><span>DRI</span><span>{player.attrs.dribbling}</span></div>
                          <div className="mp-draft-attr"><span>DEF</span><span>{player.attrs.defending}</span></div>
                          <div className="mp-draft-attr"><span>PHY</span><span>{player.attrs.physical}</span></div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  className="mp-btn mp-btn-primary mp-btn-full"
                  disabled={!selectedPlayer}
                  onClick={handleConfirmPick}
                >
                  Confirm Pick
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mp-creation">
      <div className="mp-creation-header">
        <div className="mp-creator-info">
          <span className="mp-creator-dot" style={{ background: currentPlayer.color }} />
          <span className="mp-creator-name">{currentPlayer.name}'s Team</span>
        </div>
        <div className="mp-timer">
          <span className="mp-timer-icon">⏱</span>
          <span className={`mp-timer-value ${countdown <= 15 ? 'urgent' : ''}`}>{countdown}s</span>
        </div>
      </div>

      <div className="mp-creation-body">
        <div className="mp-form-group">
          <label>Team Name</label>
          <input className="mp-input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder={`${currentPlayer.name}'s Team`} maxLength={30} />
        </div>
        <div className="mp-form-group">
          <label>Short Name (max 4)</label>
          <input className="mp-input" value={shortName} onChange={e => setShortName(e.target.value.toUpperCase().slice(0, 4))} placeholder="TEAM" maxLength={4} />
        </div>
        <div className="mp-form-group">
          <label>Team Color</label>
          <div className="mp-color-grid">
            {TEAM_COLORS.map(c => (
              <button key={c} className={`mp-color-swatch-lg ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="mp-form-group">
          <label>Formation</label>
          <div className="mp-formation-options">
            {FORMATION_OPTIONS.map(f => (
              <button
                key={f}
                className={`mp-formation-btn ${formation === f ? 'active' : ''}`}
                onClick={() => handleFormationChange(f)}
              >
                {f}
                <span className="mp-formation-desc">{FORMATIONS[f].length} players</span>
              </button>
            ))}
          </div>
        </div>
        <button className="mp-btn mp-btn-primary mp-btn-full" onClick={() => {
          setSlots(createEmptySlots(formation))
          setCurrentSlotIdx(0)
          setDraftComplete(false)
          setStep('draft')
        }}>
          Start Draft: Pick 11 Real Players
        </button>
      </div>
    </div>
  )
}