import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers } from '../api/leagues'
import { getDraftPicks } from '../api/draft'
import { getLeagueMatches, saveMatchResult, updateMatchResult, getMatchById } from '../api/matches'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { generateLLMMatch } from '../../match/engine/LLMSimulator'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { LLMMatchView } from '../../match/components/LLMMatchView'
import { LEAGUES, type LeagueDefinition } from '../../league/data/clubs'
import { type TeamData, type TeamSide, type Position } from '../../match/types'
import { supabase } from '../../supabase/client'
import type { League, LeagueMember, MatchRecord } from '../../supabase/types'
import type { DraftPick } from '../../supabase/types'
import type { Club } from '../../league/types'

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

  const [watchMatchId, setWatchMatchId] = useState<string | null>(null)
  const [watchData, setWatchData] = useState<{
    homeTeam: TeamData; awayTeam: TeamData
    events: any[]; llmEvents: any[]
    homeGoals: number; awayGoals: number
    matchId: string
  } | null>(null)

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

    if (existing.length === 0) {
      const leagueDef = LEAGUES.find(def => def.id === l.league_type)
      const usedNames = new Set(ht.map(t => t.teamName))
      const bots = (leagueDef?.clubs || []).filter(c => !usedNames.has(c.name))
      setBotClubs(bots)

      const allTeamNames = [...ht.map(t => t.teamName), ...bots.map(b => b.name)]
      if (allTeamNames.length < 2) { setLoading(false); return }

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

  useEffect(() => { load() }, [leagueId])

  useEffect(() => {
    if (!loading && matches.length > 0 && league) {
      autoSimulate()
    }
  }, [loading, matches.length, league?.current_week])

  async function autoSimulate() {
    if (!league || simulating) return
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

      if (!hasHumanMatch) {
        await simulateWeek(weekMatches)
        currentWeek++
        advanced = true
      } else if (weekMatches.some(m => m.home_member_id && m.away_member_id && m.status === 'pending')) {
        setSimulating(false)
        return
      } else {
        currentWeek++
      }
    }

    if (advanced) {
      const refreshed = await getLeagueMatches(leagueId)
      setMatches(refreshed)
    }
    setSimulating(false)
  }

  async function simulateWeek(weekMatches: MatchRecord[]) {
    const allClubs = [...botClubs]

    for (const match of weekMatches) {
      let homeData: TeamData, awayData: TeamData

      if (match.home_member_id) {
        const ht = humanTeams.find(t => t.memberId === match.home_member_id)
        if (!ht || ht.players.length < 11) continue
        homeData = draftPicksToTeamData(ht.players, match.home_team_name, '', 'home')
      } else {
        const club = allClubs.find(c => c.name === match.home_team_name) || botClubs.find(c => c.name === match.home_team_name)
        if (!club) continue
        homeData = clubToTeamData(club, 'home')
      }

      if (match.away_member_id) {
        const at = humanTeams.find(t => t.memberId === match.away_member_id)
        if (!at || at.players.length < 11) continue
        awayData = draftPicksToTeamData(at.players, match.away_team_name, '', 'away')
      } else {
        const club = allClubs.find(c => c.name === match.away_team_name) || botClubs.find(c => c.name === match.away_team_name)
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
    } catch (err: any) {
      console.error('LLM match failed, using FastSimulator fallback:', err)
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

  async function handleSimulateAllRemaining() {
    if (!league || simulating) return
    setSimulating(true)

    const allClubs = [...botClubs]
    let currentWeek = (league.current_week || 1)
    const totalWeeks = matches.length > 0 ? Math.max(...matches.map(m => m.week_number)) : 38

    for (let w = currentWeek; w <= totalWeeks; w++) {
      const weekMatches = matches.filter(m => m.week_number === w && m.status === 'pending')
      const hasHumanMatch = weekMatches.some(m => m.home_member_id && m.away_member_id)
      if (hasHumanMatch) break
      await simulateWeek(weekMatches)
    }

    const refreshed = await getLeagueMatches(leagueId)
    setMatches(refreshed)
    setSimulating(false)
  }

  function handleMatchFinish() {
    setWatchData(null)
    setWatchMatchId(null)
    load()
  }

  const botTeamNames = botClubs.map(c => c.name)
  const currentWeek = league?.current_week || 1
  const totalWeeks = matches.length > 0 ? Math.max(...matches.map(m => m.week_number)) : 38

  const pending = matches.filter(m => m.week_number === currentWeek && m.status === 'pending')
  const hasHumanMatch = pending.some(m => m.home_member_id && m.away_member_id)
  const allTeams = [...humanTeams.map(t => ({ name: t.teamName, color: t.teamColor, isHuman: true })), ...botClubs.map(c => ({ name: c.name, color: c.color, isHuman: false }))]

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

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 900 }}>
        <h1>{league.name}</h1>
        <p className="league-type">Season Simulator</p>

        {hasHumanMatch && (
          <div style={{ background: '#1a3a2e', border: '1px solid #27ae60', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px' }}>⚔ Human vs Human Match This Week!</h3>
            {pending.filter(m => m.home_member_id && m.away_member_id).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <strong>{m.home_team_name}</strong>
                <span>vs</span>
                <strong>{m.away_team_name}</strong>
              </div>
            ))}
            <button onClick={handlePlayMatch} className="btn-primary" style={{ marginTop: 8 }}>
              Play Match (AI Commentary)
            </button>
          </div>
        )}

        {!hasHumanMatch && (
          <div style={{ marginBottom: 16 }}>
            <p>Week {currentWeek} of {totalWeeks} — auto-simulating (no human match this week)</p>
            {pending.length > 0 && (
              <button onClick={handleSimulateAllRemaining} disabled={simulating} className="btn-primary" style={{ marginTop: 8 }}>
                {simulating ? 'Simulating...' : 'Simulate Weeks'}
              </button>
            )}
          </div>
        )}

        <h2>Standings</h2>
        <table className="league-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.name} style={{ background: s.isHuman ? '#1a1a3e' : undefined }}>
                <td>{i + 1}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color }} />
                  {s.name}
                  {s.isHuman && <small style={{ color: '#888' }}>(you)</small>}
                </td>
                <td>{s.played}</td>
                <td>{s.wins}</td>
                <td>{s.draws}</td>
                <td>{s.losses}</td>
                <td>{s.gf}</td>
                <td>{s.ga}</td>
                <td>{s.gd > 0 ? '+' : ''}{s.gd}</td>
                <td><strong>{s.pts}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Recent Matches</h2>
        {matches.filter(m => m.status === 'finished').slice(-10).reverse().map(m => (
          <div key={m.id} className="fixture-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', marginBottom: 3, background: '#1a1a2e', borderRadius: 4, fontSize: 13 }}>
            <span>{m.home_team_name}</span>
            <strong>{m.home_goals} - {m.away_goals}</strong>
            <span>{m.away_team_name}</span>
          </div>
        ))}
        {matches.filter(m => m.status === 'finished').length === 0 && <p>No matches played yet.</p>}

        <div style={{ marginTop: 20 }}>
          <button onClick={() => { window.location.hash = `#/league/${leagueId}` }} className="btn-secondary">
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
