import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers } from '../api/leagues'
import { getMemberDraftPicks, saveDraftPicks, markDraftComplete } from '../api/draft'
import { getPlayersForPosition, type DraftPlayer } from '../playerPool'
import { type FormationName } from '../types'
import { FORMATIONS, type Position } from '../../match/types'
import type { League, LeagueMember } from '../../supabase/types'

const POSITION_LABELS: Record<string, string> = {
  GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB', CDM: 'CDM',
  CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM', LW: 'LW', RW: 'RW', ST: 'ST',
}

const DRAFT_TIMER_SECONDS = 60

function formatOVR(attrs: { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number }): number {
  return Math.round((attrs.pace + attrs.shooting + attrs.passing + attrs.dribbling + attrs.defending + attrs.physical) / 6)
}

interface Slot {
  position: Position
  filled: boolean
  player: DraftPlayer | null
}

function createEmptySlots(formation: FormationName): Slot[] {
  return FORMATIONS[formation].map(f => ({ position: f.position as Position, filled: false, player: null }))
}

export function OnlineDraftScreen({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [myMember, setMyMember] = useState<LeagueMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [countdown, setCountdown] = useState(DRAFT_TIMER_SECONDS)

  const [formation, setFormation] = useState<FormationName>('4-4-2')
  const [slots, setSlots] = useState<Slot[]>(() => createEmptySlots('4-4-2'))
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0)
  const [options, setOptions] = useState<DraftPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayer | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [l, members] = await Promise.all([getLeague(leagueId), getLeagueMembers(leagueId)])
        if (!l) { setError('League not found'); setLoading(false); return }
        setLeague(l)
        const mine = (members as any[]).find((m: any) => m.profile_id === user?.id)
        if (!mine) { setError('You are not a member of this league'); setLoading(false); return }
        setMyMember(mine)

        if (mine.draft_completed) {
          setDone(true)
          setLoading(false)
          return
        }

        const existing = await getMemberDraftPicks(mine.id)
        if (existing && existing.length > 0) {
          const restored: Slot[] = []
          const formationUsed = '4-4-2'
          const empty = createEmptySlots(formationUsed as FormationName)
          for (const ep of empty) {
            const match = existing.find(p => p.position === ep.position)
            if (match) {
              restored.push({
                position: ep.position,
                filled: true,
                player: {
                  name: match.player_name,
                  number: 0,
                  position: match.position as Position,
                  clubId: '',
                  clubName: match.player_club || '',
                  clubShortName: match.player_club || '?',
                  clubColor: '#fff',
                  leagueName: '',
                  overall: 0,
                  attrs: match.attributes as any,
                },
              })
            } else {
              restored.push(ep)
            }
          }
          setSlots(restored)
          setFormation(formationUsed as FormationName)
          const nextUnfilled = restored.findIndex(s => !s.filled)
          if (nextUnfilled < 0) {
            setDone(true)
          } else {
            setCurrentSlotIdx(nextUnfilled)
            fetchOptionsForSlot(restored, nextUnfilled)
          }
        } else {
          const initial = createEmptySlots('4-4-2')
          setSlots(initial)
          setCurrentSlotIdx(0)
          fetchOptionsForSlot(initial, 0)
        }
        setLoading(false)
      } catch (err: any) {
        setError(err.message || 'Failed to load')
        setLoading(false)
      }
    })()
  }, [leagueId, user?.id])

  // Countdown timer
  useEffect(() => {
    if (done || loading) return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAutoFinish()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [done, loading])

  function fetchOptionsForSlot(currentSlots: Slot[], idx: number) {
    const slot = currentSlots[idx]
    if (!slot || slot.filled) return
    const exclude = currentSlots.filter(s => s.filled && s.player).map(s => s.player!.name)
    const newOptions = getPlayersForPosition(slot.position, 3, exclude)
    setOptions(newOptions)
    setSelectedPlayer(null)
  }

  function handleRoll() {
    const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
    const newOptions = getPlayersForPosition(slots[currentSlotIdx].position, 3, exclude)
    setOptions(newOptions)
    setSelectedPlayer(null)
  }

  async function handleConfirm() {
    if (!selectedPlayer || !myMember) return
    const newSlots = [...slots]
    newSlots[currentSlotIdx] = { position: slots[currentSlotIdx].position, filled: true, player: selectedPlayer }
    setSlots(newSlots)
    setSelectedPlayer(null)

    const nextIdx = newSlots.findIndex((s, i) => !s.filled && i !== currentSlotIdx)
    if (nextIdx < 0) {
      setDone(true)
    } else {
      setCurrentSlotIdx(nextIdx)
      fetchOptionsForSlot(newSlots, nextIdx)
    }

    const picks = newSlots
      .filter(s => s.filled && s.player)
      .map((s, i) => ({
        league_id: leagueId,
        member_id: myMember.id,
        player_name: s.player!.name,
        player_club: s.player!.clubShortName,
        position: s.position,
        attributes: s.player!.attrs as any,
        pick_round: i,
        pick_order: i,
      }))
    await saveDraftPicks(leagueId, myMember.id, picks)
    setCountdown(DRAFT_TIMER_SECONDS)
  }

  async function handleAutoFinish() {
    if (!myMember) return
    const finalSlots = slots.map((slot, i) => {
      if (slot.filled) return slot
      const exclude = slots.filter(s => s.filled && s.player).map(s => s.player!.name)
      const autoPick = getPlayersForPosition(slot.position, 1, exclude)
      return { position: slot.position, filled: true, player: autoPick[0] || null }
    })
    setSlots(finalSlots)
    setDone(true)
    const picks = finalSlots
      .filter(s => s.filled && s.player)
      .map((s, i) => ({
        league_id: leagueId,
        member_id: myMember.id,
        player_name: s.player!.name,
        player_club: s.player!.clubShortName,
        position: s.position,
        attributes: s.player!.attrs as any,
        pick_round: i,
        pick_order: i,
      }))
    await saveDraftPicks(leagueId, myMember.id, picks)
  }

  async function handleFinish() {
    if (!myMember) return
    await markDraftComplete(myMember.id)
    window.location.hash = `#/league/${leagueId}`
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading draft...</p></div>
  if (error) return <div className="auth-page"><div className="auth-card"><h1>Error</h1><p>{error}</p><a href={`#/league/${leagueId}`} className="auth-link">Back to lobby</a></div></div>

  const currentSlot = slots[currentSlotIdx]
  const filledCount = slots.filter(s => s.filled).length

  if (done) {
    return (
      <div className="mp-creation">
        <div className="mp-creation-header">
          <h1>Draft Complete</h1>
        </div>
        <div className="mp-draft-complete" style={{ padding: 24 }}>
          <h2>Your Team</h2>
          <div className="mp-draft-summary">
            {slots.map((slot, i) => {
              if (!slot.player) return null
              return (
                <div key={i} className="mp-draft-summary-row">
                  <span className="mp-draft-summary-pos">{POSITION_LABELS[slot.position]}</span>
                  <span className="mp-draft-summary-name">{slot.player.name}</span>
                  <span className="mp-draft-summary-ovr">{formatOVR(slot.player.attrs)}</span>
                </div>
              )
            })}
          </div>
          <div className="mp-draft-summary-avg">
            Team Avg: {Math.round(slots.reduce((s, sl) => s + (sl.player ? formatOVR(sl.player.attrs) : 0), 0) / 11)} OVR
          </div>
          <button className="mp-btn mp-btn-primary mp-btn-full" onClick={handleFinish}>Lock Team & Return to Lobby</button>
        </div>
      </div>
    )
  }

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="mp-creation">
      <div className="mp-creation-header">
        <div className="mp-creator-info">
          <span className="mp-creator-name">Draft</span>
        </div>
        <div className="mp-timer">
          <span className={`mp-timer-value ${countdown <= 15 ? 'urgent' : ''}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="mp-draft-progress">
          <span className="mp-draft-count">{filledCount}/11</span>
          <div className="mp-draft-track">
            <div className="mp-draft-fill" style={{ width: `${(filledCount / 11) * 100}%` }} />
          </div>
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
                  title={p ? `${p.name} - ${formatOVR(p.attrs)} OVR` : ''}
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
          <div className="mp-draft-pick-header">
            <span className="mp-draft-pick-pos">Pick #{filledCount + 1}: {POSITION_LABELS[currentSlot.position]}</span>
            <span className="mp-draft-pick-rolls">
              <button className="mp-draft-roll-btn" onClick={handleRoll}>↩ Roll</button>
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
                  onClick={() => setSelectedPlayer(player)}
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

          <button className="mp-btn mp-btn-primary mp-btn-full" disabled={!selectedPlayer} onClick={handleConfirm}>
            Confirm Pick
          </button>
        </div>
      </div>
    </div>
  )
}
