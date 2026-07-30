import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeagueByInviteCode, joinLeague } from '../api/leagues'
import type { League } from '../../supabase/types'

export function JoinLeaguePage({ inviteCode }: { inviteCode: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    getLeagueByInviteCode(inviteCode).then(l => {
      setLeague(l)
      setLoading(false)
    })
  }, [inviteCode])

  async function handleJoin() {
    if (!user || !league) return
    setError('')
    setJoining(true)
    try {
      await joinLeague(inviteCode, user.id)
      window.location.hash = `#/league/${league.id}`
    } catch (err: any) {
      setError(err.message || 'Failed to join league')
    } finally {
      setJoining(false)
    }
  }

  function goLogin() {
    sessionStorage.setItem('join_redirect', `/join/${inviteCode}`)
    window.location.hash = '#/login'
  }

  function goSignup() {
    sessionStorage.setItem('join_redirect', `/join/${inviteCode}`)
    window.location.hash = '#/signup'
  }

  if (loading) return <div className="auth-page"><div className="auth-card"><p>Looking up invite...</p></div></div>

  if (!league) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Invalid Invite</h1>
          <p>This invite code is not valid. It may have expired or the league was deleted.</p>
          <a href="#/" className="auth-link">Back to menu</a>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Join {league.name}</h1>
          <p>You need to log in or sign up to join this league.</p>
          <button onClick={goLogin} className="auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#646cff', textDecoration: 'underline', padding: '8px 16px', fontSize: 16 }}>Login</button>
          <button onClick={goSignup} className="auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#646cff', textDecoration: 'underline', padding: '8px 16px', fontSize: 16, marginLeft: 12 }}>Sign Up</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Join {league.name}</h1>
        <p>Invited to join a {league.league_type} league.</p>
        {error && <p className="auth-error">{error}</p>}
        <button onClick={handleJoin} disabled={joining}>{joining ? 'Joining...' : 'Join League'}</button>
      </div>
    </div>
  )
}
