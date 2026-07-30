import { useEffect, useState } from 'react'
import { useMultiplayerStore } from '../store'
import { useMatchStore } from '../../store/matchStore'
import { getWeekFixtures, getClubById, getClubStanding, getLeagueProgress, computeStandings } from '../../league/engine/LeagueEngine'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { MatchView } from '../../match/components/MatchView'
import { MatchEndOverlay } from '../../match/components/MatchEndOverlay'
import { MatchControls } from '../../match/components/MatchControls'
import { StatsPanel } from '../../match/components/StatsPanel'
import { EventFeed } from '../../match/components/EventFeed'
import { LLMMatchView } from '../../match/components/LLMMatchView'
import { generateLLMMatch, LLMEvent } from '../../match/engine/LLMSimulator'

export function MultiplayerLeagueScreen() {
  const league = useMultiplayerStore(s => s.league)
  const customTeams = useMultiplayerStore(s => s.customTeams)
  const setPhase = useMultiplayerStore(s => s.setPhase)
  const simWeek = useMultiplayerStore(s => s.simWeek)
  const advanceWeek = useMultiplayerStore(s => s.advanceWeek)
  const fastForwardAll = useMultiplayerStore(s => s.fastForwardAll)
  const watchingMatch = useMultiplayerStore(s => s.watchingMatch)
  const setWatchingMatch = useMultiplayerStore(s => s.setWatchingMatch)
  const simming = useMultiplayerStore(s => s.simming)
  const fastForwarding = useMultiplayerStore(s => s.fastForwarding)

  const engineRef = useMatchStore(s => s.engineRef)
  const [llmMode, setLLMMode] = useState(false)
  const [llmLoading, setLLMLoading] = useState(false)
  const [llmData, setLLMData] = useState<{
    events: import('../../match/types').MatchEvent[]
    llmEvents: LLMEvent[]
    homeGoals: number
    awayGoals: number
  } | null>(null)
  const [llmError, setLLMError] = useState<string | null>(null)

  if (!league) return null

  const playerTeamIds = customTeams.map(t => t.id)
  const weekFixtures = getWeekFixtures(league, league.currentWeek)
  const progress = getLeagueProgress(league)

  const handleBackToLeague = () => {
    setWatchingMatch(null)
    setLLMMode(false)
    setLLMData(null)
    setLLMError(null)
    const homeClub = getClubById(league, watchingMatch!.homeId)
    const awayClub = getClubById(league, watchingMatch!.awayId)
    if (!homeClub || !awayClub) return

    const updatedLeague = { ...league }
    const fixture = updatedLeague.fixtures.find(f =>
      f.homeClubId === watchingMatch!.homeId && f.awayClubId === watchingMatch!.awayId
    )
    if (fixture && engineRef?.current) {
      const state = engineRef.current.getState()
      fixture.result = {
        homeGoals: state.stats.homeGoals,
        awayGoals: state.stats.awayGoals,
        homeShots: state.stats.homeShots,
        awayShots: state.stats.awayShots,
        homeShotsOnTarget: state.stats.homeShotsOnTarget,
        awayShotsOnTarget: state.stats.awayShotsOnTarget,
        homePossession: state.stats.homePossession,
      }
      fixture.played = true
      updatedLeague.standings = computeStandings(updatedLeague.clubs, updatedLeague.fixtures)
    }
    useMultiplayerStore.getState().setLeague(updatedLeague)
  }

  const handleLLMFinish = () => {
    if (!llmData || !watchingMatch) return
    const updatedLeague = { ...league }
    const fixture = updatedLeague.fixtures.find(f =>
      f.homeClubId === watchingMatch.homeId && f.awayClubId === watchingMatch.awayId
    )
    if (fixture) {
      const homeShots = llmData.llmEvents.filter(e => e.type === 'shot' && e.team === 'home').length
      const awayShots = llmData.llmEvents.filter(e => e.type === 'shot' && e.team === 'away').length
      fixture.result = {
        homeGoals: llmData.homeGoals,
        awayGoals: llmData.awayGoals,
        homeShots,
        awayShots,
        homeShotsOnTarget: Math.round(homeShots * 0.5),
        awayShotsOnTarget: Math.round(awayShots * 0.5),
        homePossession: 50 + Math.floor(Math.random() * 10 - 5),
      }
      fixture.played = true
      updatedLeague.standings = computeStandings(updatedLeague.clubs, updatedLeague.fixtures)
    }
    useMultiplayerStore.getState().setLeague(updatedLeague)
    setWatchingMatch(null)
    setLLMMode(false)
    setLLMData(null)
    setLLMError(null)
  }

  const startLLMMatch = async (homeId: string, awayId: string) => {
    setLLMMode(true)
    setLLMLoading(true)
    setLLMError(null)

    const homeClub = getClubById(league, homeId)
    const awayClub = getClubById(league, awayId)
    if (!homeClub || !awayClub) { setLLMError('Team data not found'); setLLMLoading(false); return }

    try {
      const homeTeam = clubToTeamData(homeClub, 'home')
      const awayTeam = clubToTeamData(awayClub, 'away')
      const result = await generateLLMMatch(homeTeam, awayTeam)
      setLLMData(result)
    } catch (err: any) {
      setLLMError(err?.message ?? 'AI match generation failed. Try again.')
    } finally {
      setLLMLoading(false)
    }
  }

  if (watchingMatch && llmMode) {
    const homeClub = getClubById(league, watchingMatch.homeId)
    const awayClub = getClubById(league, watchingMatch.awayId)
    if (!homeClub || !awayClub) return null

    if (llmLoading) {
      return (
        <div className="match-screen">
          <div className="match-matchup-banner">
            <span className="match-banner-player">{homeClub.shortName}</span>
            <span className="match-banner-vs">VS</span>
            <span className="match-banner-player">{awayClub.shortName}</span>
          </div>
          <div className="llm-loading">
            <div className="llm-loading-spinner" />
            <p>AI Commentary is generating the match...</p>
            <p className="llm-loading-sub">Using tinyllama via mlvoca.com</p>
          </div>
          <div className="match-bar">
            <button className="ctrl-btn" onClick={() => { setWatchingMatch(null); setLLMMode(false); setLLMData(null); setLLMError(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )
    }

    if (llmError) {
      return (
        <div className="match-screen">
          <div className="match-matchup-banner">
            <span className="match-banner-player">{homeClub.shortName}</span>
            <span className="match-banner-vs">VS</span>
            <span className="match-banner-player">{awayClub.shortName}</span>
          </div>
          <div className="llm-loading">
            <p className="llm-error-text">Error: {llmError}</p>
            <button className="ctrl-btn" onClick={() => startLLMMatch(watchingMatch.homeId, watchingMatch.awayId)} style={{ marginTop: 12 }}>
              Retry
            </button>
            <button className="ctrl-btn" onClick={() => { setWatchingMatch(null); setLLMMode(false); setLLMData(null); setLLMError(null) }} style={{ marginTop: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )
    }

    if (llmData) {
      const homeTeam = clubToTeamData(homeClub, 'home')
      const awayTeam = clubToTeamData(awayClub, 'away')
      const homeCustom = customTeams.find(t => t.id === watchingMatch.homeId)
      const awayCustom = customTeams.find(t => t.id === watchingMatch.awayId)

      return (
        <div className="match-screen">
          <div className="match-matchup-banner">
            <span className="match-banner-player" style={{ color: homeCustom?.color }}>
              {homeCustom ? `${homeCustom.ownerName}'s ` : ''}{homeClub.shortName}
            </span>
            <span className="match-banner-vs">VS</span>
            <span className="match-banner-player" style={{ color: awayCustom?.color }}>
              {awayCustom ? `${awayCustom.ownerName}'s ` : ''}{awayClub.shortName}
            </span>
          </div>
          <LLMMatchView
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            events={llmData.events}
            llmEvents={llmData.llmEvents}
            homeGoals={llmData.homeGoals}
            awayGoals={llmData.awayGoals}
            onFinish={handleLLMFinish}
          />
        </div>
      )
    }

    return null
  }

  if (watchingMatch) {
    const homeClub = getClubById(league, watchingMatch.homeId)
    const awayClub = getClubById(league, watchingMatch.awayId)
    if (!homeClub || !awayClub) return null

    const homeCustom = customTeams.find(t => t.id === watchingMatch.homeId)
    const awayCustom = customTeams.find(t => t.id === watchingMatch.awayId)

    const homeTeam = clubToTeamData(homeClub, 'home')
    const awayTeam = clubToTeamData(awayClub, 'away')

    return (
      <div className="match-screen">
        <div className="match-matchup-banner">
          <span className="match-banner-player" style={{ color: homeCustom?.color }}>
            {homeCustom ? `${homeCustom.ownerName}'s ` : ''}{homeClub.shortName}
          </span>
          <span className="match-banner-vs">VS</span>
          <span className="match-banner-player" style={{ color: awayCustom?.color }}>
            {awayCustom ? `${awayCustom.ownerName}'s ` : ''}{awayClub.shortName}
          </span>
        </div>
        <div className="match-main">
          <div className="match-canvas-container">
            <MatchView homeTeam={homeTeam} awayTeam={awayTeam} />
            <MatchEndOverlay />
          </div>
          <div className="match-sidebar">
            <StatsPanel />
            <EventFeed />
          </div>
        </div>
        <MatchControls />
        <div className="match-bar">
          <button className="ctrl-btn" onClick={handleBackToLeague}>
            Finish Match & Back to League
          </button>
        </div>
      </div>
    )
  }

  const unplayed = weekFixtures.filter(f => !f.played)

  return (
    <div className="league-screen">
      <div className="league-layout">
        <div className="league-main">
          <div className="league-tabs">
            <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>Multiplayer League</h2>
            <div className="tab-spacer" />
            <button className="back-btn" onClick={() => setPhase('lobby')}>Lobby</button>
          </div>

          <div className="mp-league-players-bar">
            {customTeams.map(t => (
              <div key={t.id} className="mp-league-player-tag" style={{ borderColor: t.color }}>
                <span className="mp-league-player-dot" style={{ background: t.color }} />
                <span>{t.ownerName}'s {t.shortName}</span>
              </div>
            ))}
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
                </tr>
              </thead>
              <tbody>
                {league.standings.map((s, i) => {
                  const club = getClubById(league, s.clubId)
                  const isPlayer = playerTeamIds.includes(s.clubId)
                  const customTeam = customTeams.find(t => t.id === s.clubId)
                  return (
                    <tr key={s.clubId} className={isPlayer ? 'mp-player-row' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td className="team-col">
                        <span className="team-badge" style={{ background: club?.color }} />
                        <span className="team-name">{club?.shortName || s.clubId}</span>
                        {customTeam && <span className="mp-player-badge">YOU</span>}
                      </td>
                      <td>{s.played}</td>
                      <td>{s.won}</td>
                      <td>{s.drawn}</td>
                      <td>{s.lost}</td>
                      <td>{s.goalsFor}</td>
                      <td>{s.goalsAgainst}</td>
                      <td className={s.goalDiff >= 0 ? 'gd-pos' : 'gd-neg'}>{s.goalDiff > 0 ? '+' : ''}{s.goalDiff}</td>
                      <td className="pts">{s.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="season-progress">
            <span className="progress-text">Week {league.currentWeek}/{league.totalWeeks}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="progress-text">{Math.round(progress * 100)}%</span>
          </div>
        </div>

        <div className="league-sidebar">
          <div className="sidebar-actions">
            <h3>Matchweek {league.currentWeek}</h3>
            <p className="week-info">{unplayed.length} matches remaining</p>

            {!league.seasonComplete && (
              <>
                <button
                  className="action-btn primary"
                  onClick={() => { useMultiplayerStore.getState().setSimming(true); simWeek() }}
                  disabled={simming || unplayed.length === 0}
                >
                  {simming ? 'Simulating...' : `Simulate Week ${league.currentWeek}`}
                </button>
                <button
                  className="action-btn secondary"
                  onClick={fastForwardAll}
                  disabled={fastForwarding || unplayed.length === 0}
                >
                  {fastForwarding ? 'Fast Forwarding...' : '▶ Fast Forward All'}
                </button>
              </>
            )}

            <div className="match-list">
              {weekFixtures.map(f => {
                const home = getClubById(league, f.homeClubId)
                const away = getClubById(league, f.awayClubId)
                const isPlayerMatch = playerTeamIds.includes(f.homeClubId) && playerTeamIds.includes(f.awayClubId)
                const hasPlayer = playerTeamIds.includes(f.homeClubId) || playerTeamIds.includes(f.awayClubId)
                return (
                  <div key={f.id} className={`mini-fixture ${f.played ? 'done' : ''} ${isPlayerMatch ? 'player-match' : ''} ${hasPlayer && !f.played ? 'has-player' : ''}`}>
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
                      isPlayerMatch ? (
                        <div className="mini-actions">
                          <button className="watch-btn" onClick={() => setWatchingMatch({ homeId: f.homeClubId, awayId: f.awayClubId })}>
                            Watch
                          </button>
                          <button className="watch-btn ai-btn" onClick={() => {
                            setWatchingMatch({ homeId: f.homeClubId, awayId: f.awayClubId })
                            startLLMMatch(f.homeClubId, f.awayClubId)
                          }}>
                            AI Commentary
                          </button>
                        </div>
                      ) : hasPlayer ? (
                        <span className="player-match-badge quiet">AI</span>
                      ) : null
                    )}
                  </div>
                )
              })}
            </div>

            {unplayed.length === 0 && !league.seasonComplete && (
              <button className="action-btn secondary" onClick={advanceWeek}>
                Next Week
              </button>
            )}

            {league.seasonComplete && (
              <div className="season-end">
                <p>Season Complete!</p>
                {league.standings[0] && (() => {
                  const champion = getClubById(league, league.standings[0].clubId)
                  const champCustom = customTeams.find(t => t.id === league.standings[0].clubId)
                  return (
                    <p style={{ fontSize: 14, color: '#f1c40f', marginTop: 8 }}>
                      Champion: {champCustom ? `${champCustom.ownerName}'s ` : ''}{champion?.name ?? 'Unknown'}
                    </p>
                  )
                })()}
                <button className="action-btn primary" style={{ marginTop: 12 }} onClick={() => setPhase('lobby')}>
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