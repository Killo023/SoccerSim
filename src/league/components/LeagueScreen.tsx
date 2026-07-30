import { useState } from 'react'
import { useLeagueStore } from '../../store/leagueStore'
import { getWeekFixtures, setFixtureResult, advanceWeek, getClubById } from '../engine/LeagueEngine'
import { LeagueTable } from './LeagueTable'
import { FixtureList } from './FixtureList'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { MatchView } from '../../match/components/MatchView'

type LeagueView = 'table' | 'week'

export function LeagueScreen() {
  const league = useLeagueStore(s => s.league)
  const setLeague = useLeagueStore(s => s.setLeague)
  const selectedWeek = useLeagueStore(s => s.selectedWeek)
  const setView = useLeagueStore(s => s.setView)
  const [subView, setSubView] = useState<LeagueView>('table')
  const [simming, setSimming] = useState(false)
  const [watchingMatch, setWatchingMatch] = useState<{ homeId: string; awayId: string } | null>(null)

  const weekFixtures = getWeekFixtures(league, selectedWeek)
  const unplayed = weekFixtures.filter(f => !f.played)

  const simWeek = async () => {
    if (unplayed.length === 0) return
    setSimming(true)
    for (const fixture of unplayed) {
      const homeClub = getClubById(league, fixture.homeClubId)
      const awayClub = getClubById(league, fixture.awayClubId)
      if (!homeClub || !awayClub) continue
      const homeTeam = clubToTeamData(homeClub, 'home')
      const awayTeam = clubToTeamData(awayClub, 'away')
      const result = fastSimulate(homeTeam, awayTeam)
      setFixtureResult(league, fixture.id, result)
    }
    setLeague({ ...league })
    setSimming(false)
  }

  const advance = () => {
    const next = advanceWeek(league)
    if (next) {
      useLeagueStore.getState().setSelectedWeek(league.currentWeek)
    }
    setLeague({ ...league })
  }

  if (watchingMatch) {
    const homeClub = getClubById(league, watchingMatch.homeId)
    const awayClub = getClubById(league, watchingMatch.awayId)
    if (!homeClub || !awayClub) return null
    const homeTeam = clubToTeamData(homeClub, 'home')
    const awayTeam = clubToTeamData(awayClub, 'away')
    return (
      <div className="match-screen">
        <div className="match-main">
          <div className="match-canvas-container">
            <MatchView homeTeam={homeTeam} awayTeam={awayTeam} />
          </div>
        </div>
        <div className="match-bar">
          <button className="ctrl-btn" onClick={() => setWatchingMatch(null)}>
            Back to League
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="league-screen">
      <div className="league-layout">
        <div className="league-main">
          <div className="league-tabs">
            <button className={`tab-btn ${subView === 'table' ? 'active' : ''}`} onClick={() => setSubView('table')}>
              Standings
            </button>
            <button className={`tab-btn ${subView === 'week' ? 'active' : ''}`} onClick={() => setSubView('week')}>
              Fixtures
            </button>
            <div className="tab-spacer" />
            <button className="back-btn" onClick={() => setView('menu')}>Main Menu</button>
          </div>
          {subView === 'table' ? <LeagueTable /> : <FixtureList />}
        </div>
        <div className="league-sidebar">
          <div className="sidebar-actions">
            <h3>Matchweek {selectedWeek}</h3>
            <p className="week-info">{unplayed.length} matches remaining</p>
            <button
              className="action-btn primary"
              onClick={simWeek}
              disabled={simming || unplayed.length === 0}
            >
              {simming ? 'Simulating...' : `Simulate Week ${selectedWeek}`}
            </button>
            <div className="match-list">
              {weekFixtures.map(f => {
                const home = getClubById(league, f.homeClubId)
                const away = getClubById(league, f.awayClubId)
                return (
                  <div key={f.id} className={`mini-fixture ${f.played ? 'done' : ''}`}>
                    <div className="mini-teams">
                      <span className="mini-team">
                        <span className="dot" style={{ background: home?.color }} />
                        {home?.shortName}
                      </span>
                      <span className="mini-score">
                        {f.played ? `${f.result!.homeGoals} - ${f.result!.awayGoals}` : 'v'}
                      </span>
                      <span className="mini-team">
                        <span className="dot" style={{ background: away?.color }} />
                        {away?.shortName}
                      </span>
                    </div>
                    {!f.played && (
                      <button className="watch-btn" onClick={() => setWatchingMatch({ homeId: f.homeClubId, awayId: f.awayClubId })}>
                        Watch
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {unplayed.length === 0 && !league.seasonComplete && (
              <button className="action-btn secondary" onClick={advance}>
                Next Week
              </button>
            )}
            {league.seasonComplete && (
              <div className="season-end">
                <p>Season Complete!</p>
                <button className="action-btn primary" onClick={() => {
                  useLeagueStore.getState().resetSeason()
                }}>
                  New Season
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
