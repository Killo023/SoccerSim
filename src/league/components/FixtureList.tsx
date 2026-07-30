import { useLeagueStore } from '../../store/leagueStore'
import { getWeekFixtures, getClubById } from '../engine/LeagueEngine'

export function FixtureList() {
  const league = useLeagueStore(s => s.league)
  const selectedWeek = useLeagueStore(s => s.selectedWeek)
  const setSelectedWeek = useLeagueStore(s => s.setSelectedWeek)
  const setView = useLeagueStore(s => s.setView)

  const fixtures = getWeekFixtures(league, selectedWeek)
  const totalWeeks = league.totalWeeks

  return (
    <div className="fixture-list">
      <div className="panel-header small">
        <h3>Fixtures</h3>
        <div className="week-nav">
          <button
            className="week-btn"
            disabled={selectedWeek <= 1}
            onClick={() => setSelectedWeek(selectedWeek - 1)}
          >Prev</button>
          <span className="week-label">Week {selectedWeek}</span>
          <button
            className="week-btn"
            disabled={selectedWeek >= totalWeeks}
            onClick={() => setSelectedWeek(selectedWeek + 1)}
          >Next</button>
        </div>
      </div>
      <div className="fixture-scroll">
        {fixtures.map(f => {
          const home = getClubById(league, f.homeClubId)
          const away = getClubById(league, f.awayClubId)
          return (
            <div key={f.id} className={`fixture-card ${f.played ? 'played' : ''}`}>
              <div className="fixture-teams">
                <div className="fixture-team home">
                  <span className="team-badge-sm" style={{ background: home?.color }} />
                  <span>{home?.name ?? f.homeClubId}</span>
                </div>
                <div className="fixture-score">
                  {f.played ? (
                    <span className="score">{f.result!.homeGoals} - {f.result!.awayGoals}</span>
                  ) : (
                    <span className="vs">vs</span>
                  )}
                </div>
                <div className="fixture-team away">
                  <span className="team-badge-sm" style={{ background: away?.color }} />
                  <span>{away?.name ?? f.awayClubId}</span>
                </div>
              </div>
            </div>
          )
        })}
        {fixtures.length === 0 && (
          <div className="no-fixtures">No fixtures this week</div>
        )}
      </div>
    </div>
  )
}
