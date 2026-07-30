import { useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { createLeague } from '../api/leagues'

import { LEAGUES } from '../../league/data/clubs'

const LEAGUE_TYPES = LEAGUES.map(l => ({ value: l.id, label: l.name }))

export function CreateLeaguePage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [leagueType, setLeagueType] = useState('EPL')
  const [replacedTeams, setReplacedTeams] = useState(2)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setSubmitting(true)
    try {
      const league = await createLeague(name, user.id, leagueType, replacedTeams)
      window.location.hash = `#/league/${league.id}`
    } catch (err: any) {
      setError(err.message || 'Failed to create league')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create League</h1>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="League Name" value={name} onChange={e => setName(e.target.value)} required maxLength={40} />
          <select value={leagueType} onChange={e => setLeagueType(e.target.value)}>
            {LEAGUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="form-field">
            <label>Replace bottom AI teams with custom teams: {replacedTeams}</label>
            <input type="range" min={1} max={4} step={1} value={replacedTeams} onChange={e => setReplacedTeams(Number(e.target.value))} />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create League'}</button>
        </form>
        <p className="auth-link"><a href="#/">Back to menu</a></p>
      </div>
    </div>
  )
}
