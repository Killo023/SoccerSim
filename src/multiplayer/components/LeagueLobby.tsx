import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers, updateMemberTeam, updateLeagueStatus } from '../api/leagues'
import { allDraftsComplete } from '../api/draft'
import { InviteLink } from './InviteLink'
import type { League, LeagueMember } from '../../supabase/types'

export function LeagueLobby({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<(LeagueMember & { profile: { username: string; display_name: string } })[]>([])
  const [editingTeam, setEditingTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [allDrafted, setAllDrafted] = useState(false)

  async function load() {
    const [l, m] = await Promise.all([getLeague(leagueId), getLeagueMembers(leagueId)])
    setLeague(l)
    setMembers(m)
    const myMember = m.find(member => member.profile_id === user?.id)
    if (myMember) setTeamName(myMember.team_name)
    if (l && l.status === 'drafting') {
      const done = await allDraftsComplete(leagueId)
      setAllDrafted(done)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [leagueId])

  const currentMember = members.find(m => m.profile_id === user?.id)
  const isOwner = league?.owner_id === user?.id

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

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading league...</p></div>
  if (!league) return <div className="auth-page"><div className="auth-card"><p>League not found</p></div></div>

  return (
    <div className="auth-page">
      <div className="auth-card league-lobby">
        <h1>{league.name}</h1>
        <p className="league-type">{league.league_type} • {league.status}</p>

        <InviteLink inviteCode={league.invite_code} />

        <h2>Members ({members.length}/6)</h2>
        <ul className="member-list">
          {members.map(m => (
            <li key={m.id} style={{ borderLeftColor: m.team_color }}>
              <span className="member-name">{m.profile.display_name}</span>
              <span className="member-team">{m.team_name}</span>
              <span className="member-status">{m.draft_completed ? '✅ Drafted' : '⏳ Pending'}</span>
              {m.profile_id === league.owner_id && <span className="owner-badge">Owner</span>}
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
          <button onClick={handleStartDraft} className="btn-primary">Start Draft</button>
        )}

        {currentMember && league.status === 'drafting' && !currentMember.draft_completed && (
          <button onClick={() => { window.location.hash = `#/draft/${leagueId}` }}>Enter Draft</button>
        )}

        {allDrafted && league.status === 'drafting' && isOwner && (
          <button onClick={async () => { await updateLeagueStatus(league.id, 'active'); load() }}>Start Season</button>
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
