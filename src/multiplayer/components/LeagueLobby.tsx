import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers, updateMemberTeam, updateLeagueStatus } from '../api/leagues'
import { allDraftsComplete } from '../api/draft'
import { InviteLink } from './InviteLink'
import { supabase } from '../../supabase/client'
import { LEAGUES } from '../../league/data/clubs'
import type { League, LeagueMember } from '../../supabase/types'

export function LeagueLobby({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<(LeagueMember & { profile: { username: string; display_name: string } })[]>([])
  const [editingTeam, setEditingTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [allDrafted, setAllDrafted] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)

  const currentMember = members.find(m => m.profile_id === user?.id)
  const isOwner = league?.owner_id === user?.id

  async function load() {
    try {
      const [l, m] = await Promise.all([getLeague(leagueId), getLeagueMembers(leagueId)])
      if (!l) { setLoadError('League not found'); setLoading(false); return }
      setLeague(l)
      setMembers(m)
      if (l && l.status === 'drafting') {
        const done = await allDraftsComplete(leagueId)
        setAllDrafted(done)
      }
      setLoadError(null)
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load league')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [leagueId])

  useEffect(() => {
    const myMember = members.find(m => m.profile_id === user?.id)
    if (myMember && !editingTeam) setTeamName(myMember.team_name)
  }, [members, user?.id, editingTeam])

  async function handleSaveTeam() {
    if (!currentMember) return
    await updateMemberTeam(currentMember.id, teamName, currentMember.team_color)
    setEditingTeam(false)
    load()
  }

  async function handleStartDraft() {
    if (!league) return
    await updateLeagueStatus(league.id, 'drafting')
    load()
  }

  async function handleToggleReady() {
    if (!currentMember) return
    await supabase.rpc('set_member_ready', { p_member_id: currentMember.id, p_ready: !currentMember.ready })
    load()
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading league...</p></div>

  if (loadError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Error Loading League</h1>
          <p className="auth-error">{loadError}</p>
          <p style={{ fontSize: 12, color: '#666' }}>Make sure you have run the latest SQL setup in Supabase. Check console for details.</p>
          <button onClick={() => { setLoadError(null); setLoading(true); load() }}>Retry</button>
          <a href="#/" className="auth-link" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>Back to menu</a>
        </div>
      </div>
    )
  }

  if (!league) return <div className="auth-page"><div className="auth-card"><p>League not found</p></div></div>

  const allReady = members.length >= 2 && members.every(m => m.ready)

  return (
    <div className="auth-page">
      <div className="auth-card league-lobby">
        <h1>{league.name}</h1>
        <p className="league-type">{LEAGUES.find(l => l.id === league.league_type)?.name ?? league.league_type} • {league.status}</p>

        <InviteLink inviteCode={league.invite_code} />

        <h2>Members ({members.length}/6)</h2>
        <ul className="member-list">
          {members.map(m => (
            <li key={m.id} style={{ borderLeftColor: m.team_color }}>
              <span className="member-name">{m.profile.display_name}</span>
              <span className="member-team">{m.team_name}</span>
              <span className="member-status">
                {m.ready ? '✅ Ready' : '⏳ Not Ready'}
                {m.draft_completed ? ' • ✅ Drafted' : ''}
              </span>
              {m.profile_id === league.owner_id && <span className="owner-badge">Owner</span>}
              {m.profile_id === user?.id && !m.ready && league.status === 'draft' && (
                <button onClick={handleToggleReady} className="btn-small" style={{ marginLeft: 8 }}>Ready</button>
              )}
              {m.profile_id === user?.id && m.ready && league.status === 'draft' && (
                <button onClick={handleToggleReady} className="btn-small" style={{ marginLeft: 8 }}>Not Ready</button>
              )}
            </li>
          ))}
        </ul>

        {currentMember && (
          <div className="team-settings">
            <h2>Your Team</h2>
            {editingTeam ? (
              <div className="edit-team">
                <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={30} />
                <button onClick={handleSaveTeam}>Save</button>
                <button onClick={() => setEditingTeam(false)} className="btn-secondary">Cancel</button>
              </div>
            ) : (
              <div className="team-info">
                <span>{currentMember.team_name}</span>
                <button onClick={() => setEditingTeam(true)} className="btn-small">Edit</button>
              </div>
            )}
          </div>
        )}

        {isOwner && league.status === 'draft' && (
          <button onClick={handleStartDraft} className="btn-primary" disabled={!allReady}>
            {allReady ? 'Start Draft' : `Waiting for ready (${members.filter(m => m.ready).length}/${members.length})`}
          </button>
        )}

        {currentMember && league.status === 'drafting' && !currentMember.draft_completed && (
          <button onClick={() => { window.location.hash = `#/draft/${leagueId}` }}>Enter Draft</button>
        )}

        {allDrafted && league.status === 'drafting' && isOwner && (
          <button onClick={async () => { await updateLeagueStatus(league.id, 'active'); window.location.hash = `#/online-league/${league.id}` }}>Start Season</button>
        )}

        {league.status === 'active' && (
          <div className="league-actions">
            <button onClick={() => { window.location.hash = `#/online-league/${league.id}` }}>View League Table</button>
          </div>
        )}
      </div>
    </div>
  )
}
