import { useMatchStore } from '../../store/matchStore'

export function StatsPanel() {
  const matchState = useMatchStore(s => s.matchState)
  if (!matchState) return null

  const s = matchState.stats
  const homePoss = Math.round(s.homePossession)
  const awayPoss = 100 - homePoss

  return (
    <div className="stats-panel">
      <h3>Match Statistics</h3>
      <div className="stat-row">
        <span className="stat-label">Possession</span>
        <div className="possession-bar-container">
          <div className="possession-bar">
            <div
              className="possession-fill home"
              style={{ width: `${homePoss}%` }}
            />
            <div
              className="possession-fill away"
              style={{ width: `${awayPoss}%` }}
            />
          </div>
          <div className="possession-text">
            <span className="home">{homePoss}%</span>
            <span className="away">{awayPoss}%</span>
          </div>
        </div>
      </div>
      <div className="stat-row">
        <span className="stat-label">Shots</span>
        <span className="stat-value">{s.homeShots} - {s.awayShots}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Shots on Target</span>
        <span className="stat-value">{s.homeShotsOnTarget} - {s.awayShotsOnTarget}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Goals</span>
        <span className="stat-value goals">{s.homeGoals} - {s.awayGoals}</span>
      </div>
    </div>
  )
}
