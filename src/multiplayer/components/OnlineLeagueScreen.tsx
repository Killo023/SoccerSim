import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../auth/context/useAuth'
import { getLeague, getLeagueMembers } from '../api/leagues'
import { getMemberDraftPicks, getDraftPicks } from '../api/draft'
import { getLeagueMatches, saveMatchResult, advanceLeagueWeek } from '../api/matches'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { FORMATIONS, type TeamData, type Position, type TeamSide } from '../../match/types'
import type { League, LeagueMember, DraftPick, MatchRecord } from '../../supabase/types'

interface DraftTeam {
  memberId: string
  memberName: string
  teamName: string
  teamColor: string
  players: DraftPick[]
}

function calculateOverall(attrs: Record<string, number>): number {
  return Math.round(Object.values(attrs).reduce((a, b) => a + b, 0) / Object.keys(attrs).length)
}

function draftPicksToTeamData(picks: DraftPick[], teamName: string, color: string, side: TeamSide): TeamData {
  const formationKey = Object.keys(FORMATIONS)[0] as keyof typeof FORMATIONS
  return {
    id: teamName,
    name: teamName,
    shortName: teamName.slice(0, 3).toUpperCase(),
    color,
    side,
    formation: FORMATIONS[formationKey].map(f => f.position),
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

function generateRoundRobinSchedule(teamIds: string[]): [string, string][][] {
  const n = teamIds.length
  const isOdd = n % 2 !== 0
  const allTeams = isOdd ? [...teamIds, 'BYE'] : [...teamIds]
  const numTeams = allTeams.length
  const numRounds = numTeams - 1
  const rounds: [string, string][][] = []

  for (let round = 0; round < numRounds; round++) {
    const matches: [string, string][] = []
    for (let m = 0; m < numTeams / 2; m++) {
      const home = allTeams[m]
      const away = allTeams[numTeams - 1 - m]
      if (home !== 'BYE' && away !== 'BYE') {
        matches.push([home, away])
      }
    }
    rounds.push(matches)
    const last = allTeams.pop()!
    allTeams.splice(1, 0, last)
  }

  return rounds
}

export function OnlineLeagueScreen({ leagueId }: { leagueId: string }) {
  const { user } = useAuth()
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<(LeagueMember & { profile: { username: string; display_name: string } })[]>([])
  const [allPicks, setAllPicks] = useState<DraftPick[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [teams, setTeams] = useState<DraftTeam[]>([])

  async function load() {
    const [l, m, picks, existing] = await Promise.all([
      getLeague(leagueId),
      getLeagueMembers(leagueId),
      getDraftPicks(leagueId),
      getLeagueMatches(leagueId),
    ])
    setLeague(l)
    setMembers(m)
    setAllPicks(picks)
    setMatches(existing)

    const draftTeams: DraftTeam[] = m.map(member => {
      const memberPicks = picks.filter(p => p.member_id === member.id)
      return {
        memberId: member.id,
        memberName: member.profile.display_name,
        teamName: member.team_name,
        teamColor: member.team_color,
        players: memberPicks,
      }
    })
    setTeams(draftTeams)

    setLoading(false)
  }

  useEffect(() => { load() }, [leagueId])

  const currentWeek = matches.length > 0
    ? Math.max(...matches.map(m => m.week_number))
    : 0

  const weeks = Array.from(new Set(matches.map(m => m.week_number))).sort((a, b) => a - b)

  const standings = teams.map(team => {
    const teamMatches = matches.filter(m => m.home_team_name === team.teamName || m.away_team_name === team.teamName)
    const wins = teamMatches.filter(m => {
      if (m.home_team_name === team.teamName) return m.home_goals > m.away_goals
      return m.away_goals > m.home_goals
    }).length
    const draws = teamMatches.filter(m => m.home_goals === m.away_goals).length
    const losses = teamMatches.length - wins - draws
    const gf = teamMatches.reduce((sum, m) => sum + (m.home_team_name === team.teamName ? m.home_goals : m.away_goals), 0)
    const ga = teamMatches.reduce((sum, m) => sum + (m.home_team_name === team.teamName ? m.away_goals : m.home_goals), 0)
    return { ...team, played: teamMatches.length, wins, draws, losses, gf, ga, gd: gf - ga, pts: wins * 3 + draws }
  }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)

  const handleSimulate = useCallback(async () => {
    if (!league || simulating) return
    setSimulating(true)

    try {
      const nextWeek = currentWeek + 1
      const memberIds = members.map(m => m.id)
      if (memberIds.length < 2) return

      const schedule = generateRoundRobinSchedule(memberIds)
      const weekIndex = nextWeek - 1
      if (weekIndex >= schedule.length) return

      const fixtures = schedule[weekIndex]

      for (const [homeMemberId, awayMemberId] of fixtures) {
        const homeTeam = teams.find(t => t.memberId === homeMemberId)
        const awayTeam = teams.find(t => t.memberId === awayMemberId)
        if (!homeTeam || !awayTeam) continue

        const homeData = draftPicksToTeamData(homeTeam.players, homeTeam.teamName, homeTeam.teamColor, 'home')
        const awayData = draftPicksToTeamData(awayTeam.players, awayTeam.teamName, awayTeam.teamColor, 'away')

        const result = fastSimulate(homeData, awayData)

        await saveMatchResult({
          league_id: leagueId,
          week_number: nextWeek,
          home_member_id: homeMemberId,
          away_member_id: awayMemberId,
          home_team_name: homeTeam.teamName,
          away_team_name: awayTeam.teamName,
          home_goals: result.homeGoals,
          away_goals: result.awayGoals,
          home_shots: result.homeShots,
          away_shots: result.awayShots,
          home_shots_on_target: result.homeShotsOnTarget,
          away_shots_on_target: result.awayShotsOnTarget,
          home_possession: result.homePossession,
          status: 'finished',
        })
      }

      await advanceLeagueWeek(leagueId)
      await load()
    } finally {
      setSimulating(false)
    }
  }, [league, leagueId, members, teams, currentWeek, simulating])

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading league...</p></div>
  if (!league) return <div className="auth-page"><div className="auth-card"><p>League not found</p></div></div>

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{league.name}</h1>
        <p className="league-type">Online League • Season in progress</p>

        <h2>Standings</h2>
        <table className="league-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
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
            {standings.map((s, i) => (
              <tr key={s.memberId}>
                <td>{i + 1}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: s.teamColor }} />
                  {s.teamName} <small>({s.memberName})</small>
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

        <h2>Matches</h2>
        {weeks.length === 0 && <p>No matches played yet.</p>}
        {weeks.map(week => (
          <div key={week} style={{ marginBottom: 16 }}>
            <h3>Week {week}</h3>
            {matches.filter(m => m.week_number === week).map((m, i) => (
              <div key={m.id || i} className="fixture-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 4, background: '#1a1a2e', borderRadius: 6 }}>
                <span>{m.home_team_name}</span>
                <strong>{m.home_goals} - {m.away_goals}</strong>
                <span>{m.away_team_name}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button onClick={handleSimulate} disabled={simulating} className="btn-primary">
            {simulating ? 'Simulating...' : 'Simulate Next Week'}
          </button>
          <button onClick={() => { window.location.hash = '#/' }} className="btn-secondary">
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
