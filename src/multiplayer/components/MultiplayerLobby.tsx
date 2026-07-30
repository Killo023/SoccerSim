import { useMultiplayerStore } from '../store'
import { LEAGUES } from '../../league/data/clubs'

export function MultiplayerLobby() {
  const players = useMultiplayerStore(s => s.players)
  const customTeams = useMultiplayerStore(s => s.customTeams)
  const setPhase = useMultiplayerStore(s => s.setPhase)
  const selectedBaseLeagueId = useMultiplayerStore(s => s.selectedBaseLeagueId)
  const setSelectedBaseLeagueId = useMultiplayerStore(s => s.setSelectedBaseLeagueId)
  const replaceCount = useMultiplayerStore(s => s.replaceCount)
  const setReplaceCount = useMultiplayerStore(s => s.setReplaceCount)
  const startLeague = useMultiplayerStore(s => s.startLeague)

  const maxReplace = Math.min(customTeams.length, LEAGUES.find(l => l.id === selectedBaseLeagueId)?.clubs.length ?? 20)

  return (
    <div className="mp-lobby">
      <div className="mp-lobby-card">
        <h1 className="mp-title">Teams Ready!</h1>
        <p className="mp-subtitle">{players.length} players, {customTeams.length} teams created</p>

        <div className="mp-lobby-teams">
          {customTeams.map(t => (
            <div key={t.id} className="mp-lobby-team">
              <span className="mp-lobby-dot" style={{ background: t.color }} />
              <div className="mp-lobby-team-info">
                <span className="mp-lobby-team-name">{t.name}</span>
                <span className="mp-lobby-team-owner">by {t.ownerName}</span>
              </div>
              <span className="mp-lobby-team-formation">{t.formation.length}-man</span>
              <span className="mp-lobby-team-rating">
                {Math.round(t.players.reduce((s, p) => s + (p.attrs.pace + p.attrs.shooting + p.attrs.passing + p.attrs.dribbling + p.attrs.defending + p.attrs.physical) / 6, 0) / t.players.length)} OVR
              </span>
            </div>
          ))}
        </div>

        <div className="mp-lobby-settings">
          <h3>League Settings</h3>
          <div className="mp-form-group">
            <label>Base League</label>
            <div className="mp-lobby-league-options">
              {LEAGUES.map(l => (
                <button
                  key={l.id}
                  className={`mp-lobby-league-btn ${selectedBaseLeagueId === l.id ? 'active' : ''}`}
                  onClick={() => setSelectedBaseLeagueId(l.id)}
                >
                  {l.shortName}
                </button>
              ))}
            </div>
          </div>
          <div className="mp-form-group">
            <label>Replace {replaceCount} AI team(s) with your teams</label>
            <div className="mp-lobby-slider">
              <input
                type="range"
                min={2}
                max={maxReplace}
                value={replaceCount}
                onChange={e => setReplaceCount(Number(e.target.value))}
              />
              <span className="mp-lobby-slider-val">{replaceCount}</span>
            </div>
          </div>
        </div>

        <button className="mp-btn mp-btn-primary mp-btn-full" onClick={startLeague}>
          Start League Season!
        </button>
        <button className="mp-btn mp-btn-full" onClick={() => setPhase('creating')} style={{ marginTop: 8 }}>
          Back to Team Creation
        </button>
      </div>
    </div>
  )
}