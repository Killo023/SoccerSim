import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers } from '../api/leagues'
import { getMemberDraftPicks, saveDraftPicks, markDraftComplete, setMemberManager } from '../api/draft'
import { getPlayersForPosition, type DraftPlayer } from '../playerPool'
import { FANTASY_MANAGERS, getFantasyManager, managerFormationPositions, computeChemistry, computeSystemProficiency, computeSquadRatings, type FantasyManager } from '../fantasyManagers'
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

function createEmptySlots(formationPositions: Position[]): Slot[] {
  return formationPositions.map(p => ({ position: p, filled: false, player: null }))
}

function draftPlayerFromPick(match: any): DraftPlayer {
  return {
    name: match.player_name,
    number: 0,
    position: match.position as Position,
    clubId: '',
    clubName: match.player_club || '',
    clubShortName: match.player_club || '?',
    clubColor: '#fff',
    leagueName: '',
    overall: match.player_rating ?? 0,
    attrs: match.attributes as any,
    nationality: match.player_nationality ?? undefined,
    playstyle: match.player_playstyle ?? undefined,
    rating: match.player_rating ?? undefined,
  }
}

function ManagerPicker({ members, myMember, onPicked }: {
  members: (LeagueMember & { profile: any })[]
  myMember: LeagueMember
  onPicked: () => void
}) {
  const [error, setError] = useState('')
  const [picking, setPicking] = useState<string | null>(null)

  const taken = new Set(
    members.filter(m => m.id !== myMember.id && m.manager_id).map(m => m.manager_id!)
  )

  async function pick(manager: FantasyManager) {
    if (taken.has(manager.id) || picking) return
    setPicking(manager.id)
    setError('')
    try {
      await setMemberManager(myMember.id, manager.id)
      onPicked()
    } catch (err: any) {
      setError(err.message || 'Manager could not be selected')
      setPicking(null)
    }
  }

  return (
    <div className="mp-creation">
      <div className="mp-creation-header">
        <div className="mp-creator-info">
          <span className="mp-creator-name">Pick Your Manager</span>
        </div>
      </div>
      <div className="ff-manager-picker-body">
        <p className="ff-picker-intro">
          Choose a fantasy manager. Each has a preferred formation and a playstyle system per position —
          players drafted into a slot gain a <strong>system proficiency</strong> bonus when their playstyle
          matches the manager's requirement. Managers are first-come, first-served.
        </p>
        {error && <div className="ol-error-banner"><span>{error}</span></div>}
        <div className="ff-manager-grid">
          {FANTASY_MANAGERS.map(mgr => {
            const isTaken = taken.has(mgr.id)
            return (
              <button
                key={mgr.id}
                className={`ff-manager-card ${isTaken ? 'taken' : ''} ${picking === mgr.id ? 'picking' : ''}`}
                onClick={() => pick(mgr)}
                disabled={isTaken}
              >
                <div className="ff-manager-card-top">
                  <span className="ff-manager-name">{mgr.name}</span>
                  <span className="ff-manager-meta">{mgr.nationality} · {mgr.formation}</span>
                </div>
                <div className="ff-manager-philosophy">{mgr.philosophy}</div>
                <div className="ff-manager-system">
                  {managerFormationPositions(mgr).filter((p, i, arr) => arr.indexOf(p) === i).map(p => {
                    const required = mgr.system[p]
                    if (!required) return null
                    return (
                      <span key={p} className="ff-system-chip">
                        <b>{POSITION_LABELS[p]}</b> {required}
                      </span>
                    )
                  })}
                </div>
                {isTaken && <div className="ff-manager-taken">Taken</div>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function OnlineDraftScreen({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [myMember, setMyMember] = useState<LeagueMember | null>(null)
  const [members, setMembers] = useState<(LeagueMember & { profile: any })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [countdown, setCountdown] = useState(DRAFT_TIMER_SECONDS)

  const [manager, setManager] = useState<FantasyManager | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [currentSlotIdx, setCurrentSlotIdx] = useState(0)
  const [options, setOptions] = useState<DraftPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPlayer | null>(null)
  const [showPitch, setShowPitch] = useState(false)

  // Refs so the countdown timer's auto-finish always reads the latest picks,
  // never a stale closure captured when the effect was created.
  const slotsRef = useRef<Slot[]>([])
  const myMemberRef = useRef<LeagueMember | null>(null)
  const managerRef = useRef<FantasyManager | null>(null)
  slotsRef.current = slots
  myMemberRef.current = myMember
  managerRef.current = manager

  useEffect(() => {
    (async () => {
      try {
        const [l, m] = await Promise.all([getLeague(leagueId), getLeagueMembers(leagueId)])
        if (!l) { setError('League not found'); setLoading(false); return }
        setLeague(l)
        setMembers(m)
        const mine = (m as any[]).find((x: any) => x.profile_id === user?.id)
        if (!mine) { setError('You are not a member of this league'); setLoading(false); return }
        setMyMember(mine)

        const mgr = getFantasyManager(mine.manager_id)
        if (mgr) {
          setManager(mgr)
          await setupDraft(mgr, mine.id)
        }
        setLoading(false)
      } catch (err: any) {
        setError(err.message || 'Failed to load')
        setLoading(false)
      }
    })()
  }, [leagueId, user?.id])

  async function setupDraft(mgr: FantasyManager, memberId: string) {
    const formationPositions = managerFormationPositions(mgr)
    const existing = await getMemberDraftPicks(memberId)
    if (existing && existing.length > 0) {
      // Picks are saved in formation-slot order, so restore index-to-index.
      // This correctly handles repeated positions (two CDMs, etc.) where a
      // find-by-position restore would assign the same player twice.
      const restored: Slot[] = createEmptySlots(formationPositions)
      for (let i = 0; i < existing.length && i < restored.length; i++) {
        const match = existing[i]
        restored[i].filled = true
        restored[i].player = draftPlayerFromPick(match)
      }
      setSlots(restored)
      const nextUnfilled = restored.findIndex(s => !s.filled)
      if (nextUnfilled < 0) {
        setDone(true)
      } else {
        setCurrentSlotIdx(nextUnfilled)
        fetchOptionsForSlot(restored, nextUnfilled)
      }
    } else {
      const initial = createEmptySlots(formationPositions)
      setSlots(initial)
      setCurrentSlotIdx(0)
      fetchOptionsForSlot(initial, 0)
    }
  }

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

  function buildPicks(mgr: FantasyManager, memberId: string, allSlots: Slot[]) {
    return allSlots
      .filter(s => s.filled && s.player)
      .map((s, i) => ({
        league_id: leagueId,
        member_id: memberId,
        player_name: s.player!.name,
        player_club: s.player!.clubShortName,
        position: s.position,
        attributes: s.player!.attrs as any,
        player_playstyle: s.player!.playstyle ?? null,
        player_nationality: s.player!.nationality ?? null,
        player_rating: s.player!.rating ?? s.player!.overall ?? null,
        pick_round: i,
        pick_order: i,
      }))
  }

  async function handleConfirm() {
    if (!selectedPlayer || !myMember || !manager) return
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

    await saveDraftPicks(leagueId, myMember.id, buildPicks(manager, myMember.id, newSlots))
    setCountdown(DRAFT_TIMER_SECONDS)
  }

  async function handleAutoFinish() {
    const member = myMemberRef.current
    const mgr = managerRef.current
    const current = slotsRef.current
    if (!member || !mgr) return
    const finalSlots = current.map((slot, i) => {
      if (slot.filled) return slot
      const exclude = current.filter(s => s.filled && s.player).map(s => s.player!.name)
      const autoPick = getPlayersForPosition(slot.position, 1, exclude)
      return { position: slot.position, filled: true, player: autoPick[0] || null }
    })
    setSlots(finalSlots)
    setDone(true)
    await saveDraftPicks(leagueId, member.id, buildPicks(mgr, member.id, finalSlots))
  }

  async function handleFinish() {
    if (!myMember) return
    await markDraftComplete(myMember.id)
    window.location.hash = `#/league/${leagueId}`
  }

  // Countdown timer — reads from refs so auto-finish always uses the latest picks.
  useEffect(() => {
    if (done || loading || !manager) return
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
  }, [done, loading, manager])

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading draft...</p></div>
  if (error) return <div className="auth-page"><div className="auth-card"><h1>Error</h1><p>{error}</p><a href={`#/league/${leagueId}`} className="auth-link">Back to lobby</a></div></div>
  if (!myMember) return null

  if (!manager) {
    return <ManagerPicker members={members} myMember={myMember} onPicked={() => window.location.reload()} />
  }

  const currentSlot = slots[currentSlotIdx]
  const filledCount = slots.filter(s => s.filled).length
  const formationPositions = managerFormationPositions(manager)

  // Live fantasy metrics
  const pickData = slots.filter(s => s.filled && s.player).map(s => ({
    position: s.position,
    playstyle: s.player!.playstyle,
    nationality: s.player!.nationality,
    rating: s.player!.rating ?? s.player!.overall,
    attrs: s.player!.attrs,
  }))
  const chemistry = computeChemistry(pickData, manager)
  const systemProficiency = computeSystemProficiency(pickData, manager)
  const squadRatings = computeSquadRatings(pickData)

  if (done) {
    return (
      <div className="mp-creation">
        <div className="mp-creation-header">
          <h1>Draft Complete</h1>
        </div>
        <div className="mp-draft-complete" style={{ padding: 24 }}>
          <h2>Your Team</h2>
          <div className="ff-complete-manager">
            <span className="ff-manager-name">{manager.name}</span>
            <span className="ff-manager-meta">{manager.nationality} · {manager.formation}</span>
          </div>

          <div className="ff-metrics">
            <div className="ff-metric">
              <span className="ff-metric-label">Attack</span>
              <span className="ff-metric-value">{squadRatings.attack}</span>
            </div>
            <div className="ff-metric">
              <span className="ff-metric-label">Midfield</span>
              <span className="ff-metric-value">{squadRatings.midfield}</span>
            </div>
            <div className="ff-metric">
              <span className="ff-metric-label">Defence</span>
              <span className="ff-metric-value">{squadRatings.defence}</span>
            </div>
            <div className="ff-metric">
              <span className="ff-metric-label">GK</span>
              <span className="ff-metric-value">{squadRatings.goalkeeper}</span>
            </div>
            <div className="ff-metric ff-metric-wide">
              <span className="ff-metric-label">Chemistry</span>
              <span className="ff-metric-value">{chemistry}/100</span>
            </div>
            <div className="ff-metric ff-metric-wide">
              <span className="ff-metric-label">System Proficiency</span>
              <span className="ff-metric-value">{systemProficiency}/100</span>
            </div>
            <div className="ff-metric ff-metric-wide ff-metric-total">
              <span className="ff-metric-label">Squad Rating</span>
              <span className="ff-metric-value">{squadRatings.overall}</span>
            </div>
          </div>

          <div className="mp-draft-summary">
            {slots.map((slot, i) => {
              if (!slot.player) return null
              const required = manager.system[slot.position]
              const fits = required && required === slot.player.playstyle
              return (
                <div key={i} className={`mp-draft-summary-row ${fits ? 'ff-row-fit' : 'ff-row-miss'}`}>
                  <span className="mp-draft-summary-pos">{POSITION_LABELS[slot.position]}</span>
                  <span className="mp-draft-summary-name">{slot.player.name}</span>
                  <span className="ff-slot-required">{required ?? '—'}</span>
                  <span className="mp-draft-summary-ovr">{formatOVR(slot.player.attrs)}</span>
                  <span className={`ff-fit-badge ${fits ? 'fit' : 'miss'}`}>{fits ? '✓' : '✗'}</span>
                </div>
              )
            })}
          </div>
          <div className="mp-draft-summary-avg">
            Team Avg: {squadRatings.overall} OVR
          </div>
          <button className="mp-btn mp-btn-primary mp-btn-full" onClick={handleFinish}>Lock Team & Return to Lobby</button>
        </div>
      </div>
    )
  }

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const required = manager.system[currentSlot?.position]
  const totalSlots = formationPositions.length

  return (
    <div className="mp-creation">
      <div className="mp-creation-header">
        <div className="mp-creator-info">
          <span className="mp-creator-name">{manager.name}</span>
          <span className="ff-creator-meta">{manager.nationality} · {manager.formation}</span>
        </div>
        <div className="mp-timer">
          <span className={`mp-timer-value ${countdown <= 15 ? 'urgent' : ''}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <div className="mp-draft-progress">
          <span className="mp-draft-count">{filledCount}/{totalSlots}</span>
          <div className="mp-draft-track">
            <div className="mp-draft-fill" style={{ width: `${(filledCount / totalSlots) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="ff-live-metrics">
        <div className="ff-live-metric">
          <span className="ff-live-label">Chemistry</span>
          <div className="ff-live-bar"><div className="ff-live-fill chem" style={{ width: `${chemistry}%` }} /></div>
          <span className="ff-live-val">{chemistry}</span>
        </div>
        <div className="ff-live-metric">
          <span className="ff-live-label">System</span>
          <div className="ff-live-bar"><div className="ff-live-fill sys" style={{ width: `${systemProficiency}%` }} /></div>
          <span className="ff-live-val">{systemProficiency}</span>
        </div>
        <div className="ff-live-metric">
          <span className="ff-live-label">OVR</span>
          <div className="ff-live-bar"><div className="ff-live-fill ovr" style={{ width: `${(squadRatings.overall / 99) * 100}%` }} /></div>
          <span className="ff-live-val">{squadRatings.overall}</span>
        </div>
      </div>

      <button className="mobile-pitch-toggle" onClick={() => setShowPitch(true)}>Show Pitch</button>

      <div className="mp-draft-body">
        <div className={`mp-draft-pitch-col ${showPitch ? 'mobile-pitch-show' : 'mobile-pitch-hide'}`}>
          <button className="mobile-pitch-close" onClick={() => setShowPitch(false)}>✕ Close Pitch</button>
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
              const pos = FORMATIONS[manager.formation][i]
              const isActive = i === currentSlotIdx && !slot.filled
              const isFilled = slot.filled
              const p = slot.player
              const fits = p && manager.system[slot.position] && manager.system[slot.position] === p.playstyle
              return (
                <div
                  key={i}
                  className={`mp-draft-pitch-player ${isActive ? 'drafting' : ''} ${isFilled ? 'filled' : ''} ${p && fits ? 'system-fit' : ''} ${p && !fits ? 'system-miss' : ''}`}
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
            <span className="mp-draft-pick-pos">Pick #{filledCount + 1}: {POSITION_LABELS[currentSlot?.position]}</span>
            {required && <span className="ff-slot-required-big">Needs: {required}</span>}
            <span className="mp-draft-pick-rolls">
              <button className="mp-draft-roll-btn" onClick={handleRoll}>↩ Roll</button>
            </span>
          </div>

          <div className="mp-draft-options">
            {options.map((player, i) => {
              const ovr = formatOVR(player.attrs)
              const isSelected = selectedPlayer?.name === player.name
              const fits = required && required === player.playstyle
              return (
                <button
                  key={`${player.name}-${i}`}
                  className={`mp-draft-card ${isSelected ? 'selected' : ''} ${fits ? 'ff-card-fit' : ''}`}
                  onClick={() => setSelectedPlayer(player)}
                >
                  <div className="mp-draft-card-header">
                    <span className="mp-draft-card-pos">{POSITION_LABELS[player.position]}</span>
                    {fits && <span className="ff-fit-badge fit">✓ System</span>}
                    <span className="mp-draft-card-ovr">{ovr}</span>
                  </div>
                  <span className="mp-draft-card-name">{player.name}</span>
                  <div className="mp-draft-card-club">
                    <span className="mp-draft-card-dot" style={{ background: player.clubColor }} />
                    <span>{player.clubShortName}</span>
                  </div>
                  <div className="mp-draft-card-meta">
                    {player.playstyle && <span className={`mp-draft-card-playstyle ${fits ? 'fit' : 'nomatch'}`}>{player.playstyle}</span>}
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

          <button className="mp-btn mp-btn-primary mp-btn-full" disabled={!selectedPlayer} onClick={handleConfirm}>
            Confirm Pick
          </button>
        </div>
      </div>
    </div>
  )
}
