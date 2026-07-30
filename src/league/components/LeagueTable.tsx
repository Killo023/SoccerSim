import { useLeagueStore } from '../../store/leagueStore'
import { getClubById, getClubForm } from '../engine/LeagueEngine'

export function LeagueTable() {
  const league = useLeagueStore(s => s.league)
  const setView = useLeagueStore(s => s.setView)

  return (
    <div className="league-table-container">
      <div className="panel-header">
        <button className="back-btn" onClick={() => setView('menu')}>Back</button>
        <h2>{league.name}</h2>
        <span className="season-info">Season 1</span>
      </div>
      <div className="table-wrapper">
        <table className="league-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="team-col">Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
              <th>Form</th>
            </tr>
          </thead>
          <tbody>
            {league.standings.map((s, i) => {
              const club = getClubById(league, s.clubId)
              return (
                <tr key={s.clubId} className={i < 4 ? 'zone-ucl' : i < 6 ? 'zone-europa' : ''}>
                  <td className="pos">{i + 1}</td>
                  <td className="team-col">
                    <span className="team-badge" style={{ background: club?.color }} />
                    <span className="team-name">{club?.name ?? s.clubId}</span>
                  </td>
                  <td>{s.played}</td>
                  <td>{s.won}</td>
                  <td>{s.drawn}</td>
                  <td>{s.lost}</td>
                  <td>{s.goalsFor}</td>
                  <td>{s.goalsAgainst}</td>
                  <td className={s.goalDiff > 0 ? 'gd-pos' : s.goalDiff < 0 ? 'gd-neg' : ''}>
                    {s.goalDiff > 0 ? '+' : ''}{s.goalDiff}
                  </td>
                  <td className="pts">{s.points}</td>
                  <td className="form-cell">{s.form.map((r, i) => (
                    <span key={i} className={`form-badge form-${r.toLowerCase()}`}>{r}</span>
                  ))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="season-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(league.fixtures.filter(f => f.played).length / league.fixtures.length) * 100}%` }} />
        </div>
        <span className="progress-text">
          Week {league.currentWeek}/{league.totalWeeks}
        </span>
      </div>
    </div>
  )
}
