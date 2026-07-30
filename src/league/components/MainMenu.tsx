import { useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { useLeagueStore } from '../../store/leagueStore'

export function MainMenu() {
  const { user, profile, signOut } = useAuth()
  const setView = useLeagueStore(s => s.setView)
  const leagues = useLeagueStore(s => s.leagues)
  const selectLeague = useLeagueStore(s => s.selectLeague)
  const selectedLeagueId = useLeagueStore(s => s.selectedLeagueId)
  const league = useLeagueStore(s => s.league)
  const [showLeagueSelect, setShowLeagueSelect] = useState(false)

  const currentLeague = leagues.find(l => l.id === selectedLeagueId)

  const handleSelectLeague = (id: string) => {
    selectLeague(id)
    setShowLeagueSelect(false)
  }

  return (
    <div className="main-menu">
      <div className="menu-content">
        <div className="menu-title">
          <h1>Interactive Soccer</h1>
          <p className="subtitle">Career Mode</p>
        </div>

        {user ? (
          <div className="auth-status">
            <span>Logged in as <strong>{profile?.display_name || user.email}</strong></span>
            <button className="btn-small" onClick={() => signOut()}>Sign Out</button>
          </div>
        ) : (
          <div className="auth-status">
            <a href="#/login" className="auth-link">Login</a>
            <span style={{ margin: '0 8px', color: '#888' }}>|</span>
            <a href="#/signup" className="auth-link">Sign Up</a>
          </div>
        )}

        <div className="league-selector">
          <button className="league-select-btn" onClick={() => setShowLeagueSelect(!showLeagueSelect)}>
            <span className="league-select-label">Current League</span>
            <span className="league-select-name">{currentLeague?.name ?? 'Select League'}</span>
            <span className="league-select-arrow">{showLeagueSelect ? '▲' : '▼'}</span>
          </button>
          {showLeagueSelect && (
            <div className="league-dropdown">
              {leagues.map(l => (
                <button
                  key={l.id}
                  className={`league-option ${l.id === selectedLeagueId ? 'active' : ''}`}
                  onClick={() => handleSelectLeague(l.id)}
                >
                  <span className="league-option-name">{l.name}</span>
                  <span className="league-option-region">{l.region}</span>
                  <span className="league-option-count">{l.clubs.length} teams</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="menu-buttons">
          <button className="menu-btn primary" onClick={() => setView('league')}>
            <span className="menu-icon">🏆</span>
            <div className="menu-btn-text">
              <span className="menu-btn-title">League Mode</span>
              <span className="menu-btn-desc">{currentLeague?.name} — {currentLeague?.clubs.length} Teams</span>
            </div>
          </button>
          <button className="menu-btn" onClick={() => setView('cup')}>
            <span className="menu-icon">🏅</span>
            <div className="menu-btn-text">
              <span className="menu-btn-title">Cup Tournament</span>
              <span className="menu-btn-desc">{currentLeague?.name} Cup</span>
            </div>
          </button>
          <button className="menu-btn" onClick={() => setView('match')}>
            <span className="menu-icon">⚽</span>
            <div className="menu-btn-text">
              <span className="menu-btn-title">Quick Match</span>
              <span className="menu-btn-desc">Red FC vs Blue City</span>
            </div>
          </button>
          <button className="menu-btn primary" onClick={() => setView('multiplayer')}>
            <span className="menu-icon">👥</span>
            <div className="menu-btn-text">
              <span className="menu-btn-title">Friends League</span>
              <span className="menu-btn-desc">Create teams &amp; play together</span>
            </div>
          </button>
          {user && (
            <>
              <button className="menu-btn" onClick={() => { window.location.hash = '#/create-league' }}>
                <span className="menu-icon">➕</span>
                <div className="menu-btn-text">
                  <span className="menu-btn-title">Create Online League</span>
                  <span className="menu-btn-desc">Invite friends over the internet</span>
                </div>
              </button>
              <button className="menu-btn" onClick={() => { const code = prompt('Enter invite code:'); if (code) window.location.hash = `#/join/${code.toUpperCase()}` }}>
                <span className="menu-icon">🔗</span>
                <div className="menu-btn-text">
                  <span className="menu-btn-title">Join League</span>
                  <span className="menu-btn-desc">Enter invite code</span>
                </div>
              </button>
            </>
          )}
        </div>

        <div className="menu-status">
          <p>{currentLeague?.name} | Season 1 | Week {league.currentWeek}/{league.totalWeeks}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(league.fixtures.filter(f => f.played).length / league.fixtures.length) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
