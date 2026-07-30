import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers } from '../api/leagues'
import { getDraftPicks } from '../api/draft'
import { getLeagueMatches, updateMatchResult, advanceLeagueWeek } from '../api/matches'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { generateLLMMatch } from '../../match/engine/LLMSimulator'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { LLMMatchView } from '../../match/components/LLMMatchView'
import { ALL_CLUBS, LEAGUES } from '../../league/data/clubs'
import type { TeamData, TeamSide, Position } from '../../match/types'
import type { League, LeagueMember, MatchRecord } from '../../supabase/types'
import type { DraftPick } from '../../supabase/types'
import type { Club } from '../../league/types'
import { supabase } from '../../supabase/client'

interface DraftTeam {
  memberId: string
  memberName: string
  teamName: string
  teamColor: string
  players: DraftPick[]
}

function draftPicksToTeamData(picks: DraftPick[], teamName: string, color: string, side: TeamSide): TeamData {
  return {
    id: teamName,
    name: teamName,
    shortName: teamName.slice(0, 3).toUpperCase(),
    color,
    side,
    formation: ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as Position[],
    players: picks.map((p, i) => ({
      id: `${teamName}-${i}`,
      name: p.player_name,
      number: i + 1,
      position: p.position as Position,
      team: side,
      attrs: {
        pace: p.attributes.pace ?? 50,
        shooting: p.attributes.shooting ?? 50,
        passing: p.attributes.passing ?? 50,
        dribbling: p.attributes.dribbling ?? 50,
        defending: p.attributes.defending ?? 50,
        physical: p.attributes.physical ?? 50,
      },
      x: 0, y: 0, targetX: 0, targetY: 0,
      hasBall: false, isControlled: false,
      _dx: 0, _dy: 0, _vx: 0, _vy: 0,
    })),
  }
}

function generateDoubleRoundRobin(teamNames: string[]): [string, string][][] {
  const n = teamNames.length
  const isOdd = n % 2 !== 0
  const allTeams = isOdd ? [...teamNames, 'BYE'] : [...teamNames]
  const numTeams = allTeams.length
  const numRounds = numTeams - 1
  const rounds: [string, string][][] = []

  for (let round = 0; round < numRounds; round++) {
    const matches: [string, string][] = []
    for (let m = 0; m < numTeams / 2; m++) {
      const home = allTeams[m]
      const away = allTeams[numTeams - 1 - m]
      if (home !== 'BYE' && away !== 'BYE') matches.push([home, away])
    }
    rounds.push(matches)
    const last = allTeams.pop()!
    allTeams.splice(1, 0, last)
  }

  const secondHalf = rounds.map(r => r.map(([h, a]): [string, string] => [a, h]))
  return [...rounds, ...secondHalf]
}

export function OnlineLeagueScreen({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [humanTeams, setHumanTeams] = useState<DraftTeam[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [botClubs, setBotClubs] = useState<Club[]>([])

  const [watchData, setWatchData] = useState<{
    homeTeam: TeamData; awayTeam: TeamData
    events: any[]; llmEvents: any[]
    homeGoals: number; awayGoals: number
    matchId: string
  } | null>(null)

  const simulatingRef = useRef(false)
  const loadedRef = useRef(false)

  async function load() {
    const [l, m, picks, existing] = await Promise.all([
      getLeague(leagueId),
      getLeagueMembers(leagueId),
      getDraftPicks(leagueId),
      getLeagueMatches(leagueId),
    ])
    setLeague(l)
    setMembers(m)
    setMatches(existing)

    const ht: DraftTeam[] = m.map(member => {
      const memberPicks = picks.filter(p => p.member_id === member.id)
      return {
        memberId: member.id,
        memberName: (member as any).profile?.display_name || '?',
        teamName: member.team_name,
        teamColor: member.team_color,
        players: memberPicks,
      }
    })
    setHumanTeams(ht)

    if (!l) { setLoading(false); return }

    const usedNames = new Set(ht.map(t => t.teamName))
    const bots = ALL_CLUBS.filter(c => !usedNames.has(c.name)).slice(0, 40)
    setBotClubs(bots)

    if (existing.length === 0 && bots.length >= 4) {
      const allTeamNames = [...ht.map(t => t.teamName), ...bots.map(b => b.name)]
      const schedule = generateDoubleRoundRobin(allTeamNames)
      const fixtures: any[] = []
      for (let w = 0; w < schedule.length; w++) {
        for (const [home, away] of schedule[w]) {
          const hMember = ht.find(t => t.teamName === home)
          const aMember = ht.find(t => t.teamName === away)
          fixtures.push({
            league_id: leagueId,
            week_number: w + 1,
            home_member_id: hMember?.memberId ?? null,
            away_member_id: aMember?.memberId ?? null,
            home_team_name: home,
            away_team_name: away,
            home_goals: 0, away_goals: 0,
            home_shots: 0, away_shots: 0,
            home_shots_on_target: 0, away_shots_on_target: 0,
            home_possession: 50,
            status: 'pending',
            played_at: new Date().toISOString(),
          })
        }
      }
      const { error } = await supabase.from('matches').insert(fixtures)
      if (error) console.error('Fixture insert error:', error)
      else {
        const refreshed = await getLeagueMatches(leagueId)
        setMatches(refreshed)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      load()
    }
  }, [leagueId])

  useEffect(() => {
    if (!loading && matches.length > 0 && league && !simulatingRef.current) {
      runAutoSimulate()
    }
  }, [loading, matches.length, league?.current_week])

  async function runAutoSimulate() {
    if (!league || simulatingRef.current) return
    simulatingRef.current = true
    setSimulating(true)

    let currentWeek = league.current_week || 1
    const totalWeeks = matches.length > 0 ? Math.max(...matches.map(m => m.week_number)) : 38
    let advanced = false

    while (currentWeek <= totalWeeks) {
      const weekMatches = matches.filter(m => m.week_number === currentWeek && m.status === 'pending')
      if (weekMatches.length === 0) {
        currentWeek++
        continue
      }

      const hasHumanMatch = weekMatches.some(m => m.home_member_id && m.away_member_id)

      if (hasHumanMatch) {
        setSimulating(false)
        simulatingRef.current = false
        return
      }

      await simulateWeek(weekMatches)
      await advanceLeagueWeek(leagueId)
      currentWeek++
      advanced = true
    }

    if (advanced) {
      const refreshed = await getLeagueMatches(leagueId)
      setMatches(refreshed)
      const refreshedL = await getLeague(leagueId)
      setLeague(refreshedL)
    }

    setSimulating(false)
    simulatingRef.current = false
  }

  async function simulateWeek(weekMatches: MatchRecord[]) {
    const allClubs = [...botClubs]

    for (const match of weekMatches) {
      let homeData: TeamData, awayData: TeamData

      if (match.home_member_id) {
        const ht = humanTeams.find(t => t.memberId === match.home_member_id)
        if (!ht || ht.players.length < 11) continue
        homeData = draftPicksToTeamData(ht.players, match.home_team_name, ht.teamColor, 'home')
      } else {
        const club = allClubs.find(c => c.name === match.home_team_name)
        if (!club) continue
        homeData = clubToTeamData(club, 'home')
      }

      if (match.away_member_id) {
        const at = humanTeams.find(t => t.memberId === match.away_member_id)
        if (!at || at.players.length < 11) continue
        awayData = draftPicksToTeamData(at.players, match.away_team_name, at.teamColor, 'away')
      } else {
        const club = allClubs.find(c => c.name === match.away_team_name)
        if (!club) continue
        awayData = clubToTeamData(club, 'away')
      }

      const result = fastSimulate(homeData, awayData)
      await updateMatchResult(match.id, {
        home_goals: result.homeGoals,
        away_goals: result.awayGoals,
        home_shots: result.homeShots,
        away_shots: result.awayShots,
        home_shots_on_target: result.homeShotsOnTarget,
        away_shots_on_target: result.awayShotsOnTarget,
        home_possession: result.homePossession,
        status: 'finished',
        played_at: new Date().toISOString(),
      })
    }
  }

  async function handlePlayMatch() {
    if (!league) return

    const currentWeek = league.current_week || 1
    const pending = matches.filter(m => m.week_number === currentWeek && m.status === 'pending')
    const humanMatch = pending.find(m => m.home_member_id && m.away_member_id)
    if (!humanMatch) return

    const ht = humanTeams.find(t => t.memberId === humanMatch.home_member_id)
    const at = humanTeams.find(t => t.memberId === humanMatch.away_member_id)
    if (!ht || !at || ht.players.length < 11 || at.players.length < 11) return

    const homeTeam = draftPicksToTeamData(ht.players, humanMatch.home_team_name, ht.teamColor, 'home')
    const awayTeam = draftPicksToTeamData(at.players, humanMatch.away_team_name, at.teamColor, 'away')

    try {
      const result = await generateLLMMatch(homeTeam, awayTeam)
      const commentaryStr = JSON.stringify(result.llmEvents)

      await updateMatchResult(humanMatch.id, {
        home_goals: result.homeGoals,
        away_goals: result.awayGoals,
        status: 'finished',
        commentary: commentaryStr,
        played_at: new Date().toISOString(),
      })

      const refreshed = await getLeagueMatches(leagueId)
      setMatches(refreshed)

      setWatchData({
        homeTeam: { ...homeTeam, color: ht.teamColor },
        awayTeam: { ...awayTeam, color: at.teamColor },
        events: result.events,
        llmEvents: result.llmEvents,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        matchId: humanMatch.id,
      })
    } catch {
      const result = fastSimulate(homeTeam, awayTeam)
      await updateMatchResult(humanMatch.id, {
        home_goals: result.homeGoals,
        away_goals: result.awayGoals,
        home_shots: result.homeShots,
        away_shots: result.awayShots,
        home_shots_on_target: result.homeShotsOnTarget,
        away_shots_on_target: result.awayShotsOnTarget,
        home_possession: result.homePossession,
        status: 'finished',
        played_at: new Date().toISOString(),
      })

      const refreshed = await getLeagueMatches(leagueId)
      setMatches(refreshed)
    }
  }

  async function handleMatchFinish() {
    setWatchData(null)
    if (!league) return

    await advanceLeagueWeek(leagueId)
    const refreshedL = await getLeague(leagueId)
    setLeague(refreshedL)
    const refreshedM = await getLeagueMatches(leagueId)
    setMatches(refreshedM)
  }

  const leagueName = LEAGUES.find(l => l.id === league?.league_type)?.name ?? league?.name ?? 'Season'
  const botTeamNames = botClubs.map(c => c.name)
  const currentWeek = league?.current_week || 1
  const totalWeeks = matches.length > 0 ? Math.max(...matches.map(m => m.week_number)) : 38

  const pending = matches.filter(m => m.week_number === currentWeek && m.status === 'pending')
  const hasHumanMatch = pending.some(m => m.home_member_id && m.away_member_id)
  const allTeams = [
    ...humanTeams.map(t => ({ name: t.teamName, color: t.teamColor, isHuman: true })),
    ...botClubs.map(c => ({ name: c.name, color: c.color, isHuman: false })),
  ]

  const standings = allTeams.map(team => {
    const teamMatches = matches.filter(m => (m.home_team_name === team.name || m.away_team_name === team.name) && m.status === 'finished')
    const wins = teamMatches.filter(m => {
      if (m.home_team_name === team.name) return m.home_goals > m.away_goals
      return m.away_goals > m.home_goals
    }).length
    const draws = teamMatches.filter(m => m.home_goals === m.away_goals).length
    const losses = teamMatches.length - wins - draws
    const gf = teamMatches.reduce((sum, m) => sum + (m.home_team_name === team.name ? m.home_goals : m.away_goals), 0)
    const ga = teamMatches.reduce((sum, m) => sum + (m.home_team_name === team.name ? m.away_goals : m.home_goals), 0)
    return { ...team, played: teamMatches.length, wins, draws, losses, gf, ga, gd: gf - ga, pts: wins * 3 + draws }
  }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)

  if (watchData) {
    return (
      <LLMMatchView
        homeTeam={watchData.homeTeam}
        awayTeam={watchData.awayTeam}
        events={watchData.events}
        llmEvents={watchData.llmEvents}
        homeGoals={watchData.homeGoals}
        awayGoals={watchData.awayGoals}
        onFinish={handleMatchFinish}
      />
    )
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading league...</p></div>
  if (!league) return <div className="auth-page"><div className="auth-card"><p>League not found</p></div></div>

  const progress = totalWeeks > 0 ? Math.round((currentWeek / totalWeeks) * 100) : 0

  return (
    <div className="online-league-page">
      <div className="ol-header">
        <h1>{leagueName}</h1>
        <span className="ol-season-badge">Season 1</span>
      </div>

      <div className="ol-progress-bar">
        <div className="ol-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        <span className="ol-progress-label">Week {currentWeek} of {totalWeeks}</span>
      </div>

      {hasHumanMatch && (
        <div className="ol-human-match-banner">
          <div className="ol-hm-content">
            <span className="ol-hm-icon">⚔</span>
            <div className="ol-hm-teams">
              {pending.filter(m => m.home_member_id && m.away_member_id).map(m => (
                <span key={m.id} className="ol-hm-pair">
                  <strong>{m.home_team_name}</strong>
                  <span className="ol-hm-vs">vs</span>
                  <strong>{m.away_team_name}</strong>
                </span>
              ))}
            </div>
          </div>
          <button onClick={handlePlayMatch} className="ol-btn ol-btn-play">
            Play Match (AI Commentary)
          </button>
        </div>
      )}

      {!hasHumanMatch && (
        <div className="ol-info-bar">
          {simulating ? (
            <span className="ol-sim-spinner" />
          ) : (
            <span>Week {currentWeek} — auto-simulating...</span>
          )}
        </div>
      )}

      <div className="ol-standings-section">
        <h2 className="ol-section-title">Standings</h2>
        <table className="ol-table">
          <thead>
            <tr>
              <th className="ol-th-rank">#</th>
              <th className="ol-th-team">Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th>
              <th className="ol-th-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.name} className={s.isHuman ? 'ol-row-human' : ''}>
                <td className="ol-rank">{i + 1}</td>
                <td className="ol-team-cell">
                  <span className="ol-team-dot" style={{ backgroundColor: s.color }} />
                  <span className="ol-team-name">{s.name}</span>
                  {s.isHuman && <span className="ol-team-badge">YOU</span>}
                </td>
                <td>{s.played}</td>
                <td className="ol-stat-win">{s.wins}</td>
                <td className="ol-stat-draw">{s.draws}</td>
                <td className="ol-stat-loss">{s.losses}</td>
                <td>{s.gf}</td>
                <td>{s.ga}</td>
                <td className={s.gd > 0 ? 'ol-stat-pos' : s.gd < 0 ? 'ol-stat-neg' : ''}>{s.gd > 0 ? '+' : ''}{s.gd}</td>
                <td className="ol-pts"><strong>{s.pts}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ol-fixtures-section">
        <h2 className="ol-section-title">Recent Results</h2>
        <div className="ol-results-list">
          {matches.filter(m => m.status === 'finished').slice(-15).reverse().map(m => {
            const isHumanMatch = m.home_member_id && m.away_member_id
            return (
              <div key={m.id} className={`ol-result-row ${isHumanMatch ? 'ol-result-human' : ''}`}>
                <span className="ol-result-home">{m.home_team_name}</span>
                <span className={`ol-result-score ${isHumanMatch ? 'ol-score-human' : ''}`}>
                  {m.home_goals} - {m.away_goals}
                </span>
                <span className="ol-result-away">{m.away_team_name}</span>
              </div>
            )
          })}
          {matches.filter(m => m.status === 'finished').length === 0 && (
            <p className="ol-empty">No matches played yet.</p>
          )}
        </div>
      </div>

      <div className="ol-footer">
        <button onClick={() => { window.location.hash = `#/league/${leagueId}` }} className="ol-btn ol-btn-back">
          ← Back to Lobby
        </button>
      </div>
    </div>
  )
}
