import { useEffect, useState, useRef, useCallback } from 'react'
import { getLeague, getLeagueMembers, updateLeagueStatus } from '../api/leagues'
import { getDraftPicks } from '../api/draft'
import { getLeagueMatches, updateMatchResult, advanceLeagueWeek } from '../api/matches'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { MatchControls } from '../../match/components/MatchControls'
import { StatsPanel } from '../../match/components/StatsPanel'
import { EventFeed } from '../../match/components/EventFeed'
import { MatchEngine } from '../../match/engine/MatchEngine'
import { MatchRenderer } from '../../match/renderer/MatchRenderer'
import { ALL_CLUBS, LEAGUES } from '../../league/data/clubs'
import type { TeamData, TeamSide, Position, MatchState } from '../../match/types'
import { setMatchSeed, seedFromString } from '../../match/rng'
import type { League, MatchRecord } from '../../supabase/types'
import { useMatchStore } from '../../store/matchStore'
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

const TOTAL_TEAMS = 20

function OnlineMatchView({ homeTeam, awayTeam, onFinish }: {
  homeTeam: TeamData
  awayTeam: TeamData
  onFinish: (result: { homeGoals: number; awayGoals: number; homeShots: number; awayShots: number; homeShotsOnTarget: number; awayShotsOnTarget: number; homePossession: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [state, setState] = useState<MatchState | null>(null)

  const storeSetMatchState = useMatchStore(s => s.setMatchState)
  const storeSetEngineRef = useMatchStore(s => s.setEngineRef)
  const storeSetJumpedIn = useMatchStore(s => s.setJumpedIn)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new MatchRenderer(canvas)

    const seed = seedFromString(homeTeam.id + awayTeam.id + homeTeam.name + awayTeam.name)
    setMatchSeed(seed)
    const engine = new MatchEngine({
      homeTeam,
      awayTeam,
      onStateUpdate: (s) => {
        renderer.render(s)
        setState({ ...s })
        storeSetMatchState({ ...s })
        if (s.status === 'finished' && !finished) {
          setFinished(true)
          setResult({
            homeGoals: s.stats.homeGoals,
            awayGoals: s.stats.awayGoals,
            homeShots: s.stats.homeShots,
            awayShots: s.stats.awayShots,
            homeShotsOnTarget: s.stats.homeShotsOnTarget,
            awayShotsOnTarget: s.stats.awayShotsOnTarget,
            homePossession: s.stats.homePossession,
          })
        }
      },
    })
    storeSetEngineRef({ current: engine })
    storeSetJumpedIn(false)
    engine.start()

    const handleResize = () => { if (canvas) renderer.resize(canvas) }
    window.addEventListener('resize', handleResize)
    return () => { engine.destroy(); window.removeEventListener('resize', handleResize) }
  }, [homeTeam, awayTeam, homeTeam.id, awayTeam.id, storeSetMatchState, storeSetEngineRef, storeSetJumpedIn])

  async function handleFinish() {
    if (result) onFinish(result)
  }

  return (
    <div className="match-screen">
      <div className="match-main">
        <div className="match-canvas-container">
          <canvas
            ref={canvasRef}
            className="match-canvas"
            tabIndex={0}
            onTouchStart={e => e.preventDefault()}
            style={{ touchAction: 'manipulation' }}
          />
          {finished && (
            <div className="match-end-overlay">
              <div className="match-end-content">
                <h2>Full Time</h2>
                <div className="match-end-score">
                  <span>{homeTeam.shortName}</span>
                  <span className="match-end-num">{result?.homeGoals ?? 0} - {result?.awayGoals ?? 0}</span>
                  <span>{awayTeam.shortName}</span>
                </div>
                <button onClick={handleFinish} className="ol-btn ol-btn-play">
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="match-sidebar">
          <StatsPanel />
          <EventFeed />
        </div>
      </div>
      <MatchControls />
    </div>
  )
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return n + 'th'
}

function SeasonResults({ standings, leagueName }: { standings: ReturnType<typeof computeStandings>; leagueName: string }) {
  const sorted = [...standings].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (revealed >= sorted.length) return
    const t = setTimeout(() => setRevealed(r => r + 1), 220)
    return () => clearTimeout(t)
  }, [revealed, sorted.length])

  return (
    <div className="ol-results-page">
      <div className="ol-results-header">
        <h1>{leagueName}</h1>
        <span className="ol-season-badge">Season Complete</span>
      </div>

      <div className="ol-results-trophy">
        <span className="ol-trophy-icon">🏆</span>
        <h2>Champions</h2>
        {revealed >= sorted.length && (
          <div className="ol-champion-reveal">
            <span className="ol-champion-name">{sorted[0].name}</span>
            <span className="ol-champion-pts">{sorted[0].pts} pts</span>
          </div>
        )}
      </div>

      <div className="ol-results-list-container">
        {sorted.map((s, i) => {
          const pos = sorted.length - i
          return (
            <div
              key={s.name}
              className={`ol-result-entry ${pos === 1 ? 'ol-entry-champion' : ''} ${pos <= 3 ? 'ol-entry-podium' : ''} ${s.isHuman ? 'ol-entry-human' : ''}`}
              style={{
                animationDelay: `${i * 0.22}s`,
                opacity: revealed > i ? 1 : 0,
                transform: revealed > i ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
              }}
            >
              <span className="ol-entry-pos">{ordinal(pos)}</span>
              <span className="ol-entry-dot" style={{ backgroundColor: s.color }} />
              <span className="ol-entry-name">{s.name}</span>
              {s.isHuman && <span className="ol-team-badge">YOU</span>}
              <span className="ol-entry-pts"><strong>{s.pts}</strong> pts</span>
              <span className="ol-entry-record">{s.wins}W {s.draws}D {s.losses}L</span>
              <span className="ol-entry-gd">{s.gd > 0 ? '+' : ''}{s.gd}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function computeStandings(allTeams: { name: string; color: string; isHuman: boolean }[], matches: MatchRecord[]) {
  return allTeams.map(team => {
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
}

export function OnlineLeagueScreen({ leagueId }: { leagueId: string }) {
  const [league, setLeague] = useState<League | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botClubs, setBotClubs] = useState<Club[]>([])

  const humanTeamsRef = useRef<DraftTeam[]>([])
  const botClubsRef = useRef<Club[]>([])
  const leagueRef = useRef<League | null>(null)
  const matchesRef = useRef<MatchRecord[]>([])
  const runningRef = useRef(false)
  const playingRef = useRef(false)

  const [physicsMatch, setPhysicsMatch] = useState<{
    homeTeam: TeamData; awayTeam: TeamData
    matchId: string; homeMemberId: string; awayMemberId: string
  } | null>(null)

  async function load() {
    try {
      const [l, m, picks, existing] = await Promise.all([
        getLeague(leagueId),
        getLeagueMembers(leagueId),
        getDraftPicks(leagueId),
        getLeagueMatches(leagueId),
      ])
      leagueRef.current = l
      setLeague(l)

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
      humanTeamsRef.current = ht

      if (l) {
        const usedNames = new Set(ht.map(t => t.teamName))
        const leagueDef = LEAGUES.find(def => def.id === l.league_type)
        const botPool = leagueDef?.clubs ?? ALL_CLUBS
        const botCount = Math.max(0, TOTAL_TEAMS - ht.length)
        const bots = botPool.filter(c => !usedNames.has(c.name)).slice(0, botCount)
        botClubsRef.current = bots
        setBotClubs(bots)

        if (existing.length === 0 && bots.length >= 4) {
          const allTeamNames = [...ht.map(t => t.teamName), ...bots.map(b => b.name)]
          const schedule = generateDoubleRoundRobin(allTeamNames)
          const allFixtures: any[] = []
          for (let w = 0; w < schedule.length; w++) {
            for (const [home, away] of schedule[w]) {
              const hMember = ht.find(t => t.teamName === home)
              const aMember = ht.find(t => t.teamName === away)
              allFixtures.push({
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

          for (let i = 0; i < allFixtures.length; i += 100) {
            const chunk = allFixtures.slice(i, i + 100)
            const { error: insertErr } = await supabase.from('matches').insert(chunk)
            if (insertErr) {
              setError('Failed to generate fixtures: ' + insertErr.message)
              setLoading(false)
              return
            }
          }

          const refreshed = await getLeagueMatches(leagueId)
          matchesRef.current = refreshed
          setMatches(refreshed)
        } else {
          matchesRef.current = existing
          setMatches(existing)
        }
      } else {
        matchesRef.current = existing
        setMatches(existing)
      }
    } catch (err: any) {
      console.error('Load error:', err)
      setError(err.message || 'Failed to load league')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [leagueId])

  useEffect(() => {
    if (!loading && matchesRef.current.length > 0 && league && !runningRef.current) {
      runAutoSimulate()
    }
  }, [loading])

  useEffect(() => {
    if (loading || !league) return
    const interval = setInterval(async () => {
      if (runningRef.current) return
      const [freshMatches, freshLeague] = await Promise.all([
        getLeagueMatches(leagueId),
        getLeague(leagueId),
      ])
      matchesRef.current = freshMatches
      setMatches(freshMatches)
      if (freshLeague) {
        leagueRef.current = freshLeague
        setLeague(freshLeague)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [loading, league])

  const simulateWeek = useCallback(async (weekMatches: MatchRecord[]): Promise<MatchRecord[]> => {
    const clubs = botClubsRef.current
    const humans = humanTeamsRef.current
    const updated: MatchRecord[] = []

    for (const match of weekMatches) {
      try {
        const { data: dbMatch } = await supabase.from('matches').select('status,home_goals,away_goals,home_shots,away_shots,home_shots_on_target,away_shots_on_target,home_possession').eq('id', match.id).maybeSingle()
        if (dbMatch && dbMatch.status === 'finished') {
          updated.push({ ...match, ...dbMatch, status: 'finished' })
          continue
        }

        let homeData: TeamData, awayData: TeamData

        if (match.home_member_id) {
          const ht = humans.find(t => t.memberId === match.home_member_id)
          if (!ht || ht.players.length < 11) continue
          homeData = draftPicksToTeamData(ht.players, match.home_team_name, ht.teamColor, 'home')
        } else {
          const club = clubs.find(c => c.name === match.home_team_name)
          if (!club) continue
          homeData = clubToTeamData(club, 'home')
        }

        if (match.away_member_id) {
          const at = humans.find(t => t.memberId === match.away_member_id)
          if (!at || at.players.length < 11) continue
          awayData = draftPicksToTeamData(at.players, match.away_team_name, at.teamColor, 'away')
        } else {
          const club = clubs.find(c => c.name === match.away_team_name)
          if (!club) continue
          awayData = clubToTeamData(club, 'away')
        }

        setMatchSeed(seedFromString(homeData.id + awayData.id + homeData.name + awayData.name))
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

        updated.push({
          ...match,
          home_goals: result.homeGoals,
          away_goals: result.awayGoals,
          home_shots: result.homeShots,
          away_shots: result.awayShots,
          home_shots_on_target: result.homeShotsOnTarget,
          away_shots_on_target: result.awayShotsOnTarget,
          home_possession: result.homePossession,
          status: 'finished',
        })
      } catch (err) {
        console.error(`Error simulating match ${match.id}:`, err)
      }
    }
    return updated
  }, [])

   const runAutoSimulate = useCallback(async () => {
     if (runningRef.current) return
     runningRef.current = true
     setSimulating(true)
     setError(null)

     try {
       const { data: dbLeague } = await supabase.from('leagues').select('current_week').eq('id', leagueId).maybeSingle()
       const l = leagueRef.current
       let currentWeek = dbLeague ? dbLeague.current_week : (l?.current_week || 1)
       let totalWeeks = matchesRef.current.length > 0 ? Math.max(...matchesRef.current.map(m => m.week_number)) : 38
       let advanced = false

       while (currentWeek <= totalWeeks) {
         const weekMatches = matchesRef.current.filter(m => m.week_number === currentWeek && m.status === 'pending')
         if (weekMatches.length === 0) {
           currentWeek++
           continue
         }

         const humanMatch = weekMatches.find(m => m.home_member_id && m.away_member_id)
         if (humanMatch) {
           const { data: dbM } = await supabase.from('matches').select('status').eq('id', humanMatch.id).maybeSingle()
           if (!dbM || dbM.status !== 'finished') {
             setSimulating(false)
             const [freshMembers, freshPicks] = await Promise.all([
               getLeagueMembers(leagueId),
               getDraftPicks(leagueId),
             ])
             const freshHumans = freshMembers.map(member => ({
               memberId: member.id,
               memberName: (member as any).profile?.display_name || '?',
               teamName: member.team_name,
               teamColor: member.team_color,
               players: freshPicks.filter(p => p.member_id === member.id),
             }))
             humanTeamsRef.current = freshHumans
             const ht = freshHumans.find(t => t.memberId === humanMatch.home_member_id)
             const at = freshHumans.find(t => t.memberId === humanMatch.away_member_id)
             if (ht && at && ht.players.length >= 11 && at.players.length >= 11) {
               const homeTeam = draftPicksToTeamData(ht.players, humanMatch.home_team_name, ht.teamColor, 'home')
               const awayTeam = draftPicksToTeamData(at.players, humanMatch.away_team_name, at.teamColor, 'away')
               playingRef.current = true
               setPhysicsMatch({
                 homeTeam, awayTeam,
                 matchId: humanMatch.id,
                 homeMemberId: humanMatch.home_member_id!,
                 awayMemberId: humanMatch.away_member_id!,
               })
             }
             break
           }
         }

         const results = await simulateWeek(weekMatches)
         await advanceLeagueWeek(leagueId, currentWeek)

         const updatedMatches = matchesRef.current.map(m => {
           const r = results.find(x => x.id === m.id)
           return r || m
         })
         matchesRef.current = updatedMatches
         setMatches(updatedMatches)
         setLeague(prev => prev ? { ...prev, current_week: (prev.current_week ?? 0) + 1 } : prev)

         currentWeek++
         advanced = true
       }

       if (advanced || !hasHumanMatchInCurrentWeek(currentWeek)) {
         const refreshedL = await getLeague(leagueId)
         leagueRef.current = refreshedL
         setLeague(refreshedL)
       }

       const allFinished = matchesRef.current.every(m => m.status === 'finished')
       if (allFinished && leagueRef.current?.status !== 'finished') {
         await updateLeagueStatus(leagueId, 'finished')
         const refreshedL2 = await getLeague(leagueId)
         leagueRef.current = refreshedL2
         setLeague(refreshedL2)
       }
     } catch (err: any) {
       console.error('Auto-simulate error:', err)
       setError('Simulation error: ' + (err.message || 'Unknown error'))
     }

     setSimulating(false)
     runningRef.current = false

     function hasHumanMatchInCurrentWeek(w: number) {
       return matchesRef.current.some(m => m.week_number === w && m.home_member_id && m.away_member_id)
     }
   }, [leagueId, simulateWeek])

  async function handlePlayMatch() {
    if (playingRef.current) return
    const l = leagueRef.current
    if (!l) return

    const currentWeek = l.current_week || 1
    const pending = matchesRef.current.filter(m => m.week_number === currentWeek && m.status === 'pending')
    const humanMatch = pending.find(m => m.home_member_id && m.away_member_id)
    if (!humanMatch) { setError('No human-vs-human match found this week.'); return }

    const humans = humanTeamsRef.current
    const ht = humans.find(t => t.memberId === humanMatch.home_member_id)
    const at = humans.find(t => t.memberId === humanMatch.away_member_id)
    if (!ht || !at || ht.players.length < 11 || at.players.length < 11) { setError('Team data incomplete.'); return }

    const homeTeam = draftPicksToTeamData(ht.players, humanMatch.home_team_name, ht.teamColor, 'home')
    const awayTeam = draftPicksToTeamData(at.players, humanMatch.away_team_name, at.teamColor, 'away')

    playingRef.current = true
    setPhysicsMatch({
      homeTeam, awayTeam,
      matchId: humanMatch.id,
      homeMemberId: humanMatch.home_member_id!,
      awayMemberId: humanMatch.away_member_id!,
    })
  }

  async function handlePhysicsFinish(result: { homeGoals: number; awayGoals: number; homeShots: number; awayShots: number; homeShotsOnTarget: number; awayShotsOnTarget: number; homePossession: number }) {
    if (!physicsMatch) return
    playingRef.current = false

    const { data: existing } = await supabase.from('matches').select('status,home_goals,away_goals').eq('id', physicsMatch.matchId).maybeSingle()
    if (existing?.status === 'finished') {
      setPhysicsMatch(null)
      return
    }

    await updateMatchResult(physicsMatch.matchId, {
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

    const l = leagueRef.current
    if (l) {
      const currentWeek = l.current_week || 1
      const remainingAIMatches = matchesRef.current.filter(
        m => m.week_number === currentWeek && m.status === 'pending' && !(m.home_member_id && m.away_member_id)
      )
      if (remainingAIMatches.length > 0) {
        await simulateWeek(remainingAIMatches)
      }
    }

    setPhysicsMatch(null)
    await advanceLeagueWeek(leagueId)

    const refreshedM = await getLeagueMatches(leagueId)
    matchesRef.current = refreshedM
    setMatches(refreshedM)
    const refreshedL = await getLeague(leagueId)
    leagueRef.current = refreshedL
    setLeague(refreshedL)

    const allFin = refreshedM.every(m => m.status === 'finished')
    if (allFin && refreshedL?.status !== 'finished') {
      await updateLeagueStatus(leagueId, 'finished')
      const rl2 = await getLeague(leagueId)
      leagueRef.current = rl2
      setLeague(rl2)
    }

    if (!allFin) {
      runAutoSimulate()
    }
  }

  async function handleForceSimulate() {
    if (runningRef.current) return
    const l = leagueRef.current
    if (!l) return

    runningRef.current = true
    setSimulating(true)
    setError(null)

    try {
      let currentWeek = l.current_week || 1
      const totalWeeks = matchesRef.current.length > 0 ? Math.max(...matchesRef.current.map(m => m.week_number)) : 38

      for (let w = currentWeek; w <= totalWeeks; w++) {
        const weekMatches = matchesRef.current.filter(m => m.week_number === w && m.status === 'pending')
        if (weekMatches.length === 0) continue
        const hasHumanMatch = weekMatches.some(m => m.home_member_id && m.away_member_id)
        if (hasHumanMatch) break
        const results = await simulateWeek(weekMatches)
        await advanceLeagueWeek(leagueId)

        const updatedMatches = matchesRef.current.map(m => {
          const r = results.find(x => x.id === m.id)
          return r || m
        })
        matchesRef.current = updatedMatches
        setMatches(updatedMatches)
        setLeague(prev => prev ? { ...prev, current_week: (prev.current_week || 0) + 1 } : prev)
      }

      const refreshedL = await getLeague(leagueId)
      leagueRef.current = refreshedL
      setLeague(refreshedL)

      const allFin = matchesRef.current.every(m => m.status === 'finished')
      if (allFin && refreshedL?.status !== 'finished') {
        await updateLeagueStatus(leagueId, 'finished')
        const rl2 = await getLeague(leagueId)
        leagueRef.current = rl2
        setLeague(rl2)
      }
    } catch (err: any) {
      console.error('Force simulate error:', err)
      setError(err.message || 'Simulation error')
    }

    setSimulating(false)
    runningRef.current = false
  }

  if (physicsMatch) {
    return (
      <OnlineMatchView
        homeTeam={physicsMatch.homeTeam}
        awayTeam={physicsMatch.awayTeam}
        onFinish={handlePhysicsFinish}
      />
    )
  }

  const currentWeek = league?.current_week || 1
  const totalWeeks = matches.length > 0 ? Math.max(...matches.map(m => m.week_number)) : 38

  const pending = matches.filter(m => m.week_number === currentWeek && m.status === 'pending')
  const hasHumanMatch = pending.some(m => m.home_member_id && m.away_member_id)
  const allTeams = [
    ...humanTeamsRef.current.map(t => ({ name: t.teamName, color: t.teamColor, isHuman: true })),
    ...botClubs.map(c => ({ name: c.name, color: c.color, isHuman: false })),
  ]

  const standings = computeStandings(allTeams, matches)

  async function handleRefresh() {
    const [freshMatches, freshLeague] = await Promise.all([
      getLeagueMatches(leagueId),
      getLeague(leagueId),
    ])
    matchesRef.current = freshMatches
    setMatches(freshMatches)
    if (freshLeague) {
      leagueRef.current = freshLeague
      setLeague(freshLeague)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Building league schedule...</p></div>
  if (!league) return <div className="auth-page"><div className="auth-card"><p>League not found</p></div></div>

  if (league.status === 'finished') {
    return <SeasonResults standings={standings} leagueName={LEAGUES.find(l => l.id === league.league_type)?.name ?? league.name} />
  }

  const progress = totalWeeks > 0 ? Math.round((currentWeek / totalWeeks) * 100) : 0
  const leagueName = LEAGUES.find(l => l.id === league.league_type)?.name ?? league.name
  const finishedCount = matches.filter(m => m.status === 'finished').length

  return (
    <div className="online-league-page">
      <div className="ol-header">
        <h1>{leagueName}</h1>
        <span className="ol-season-badge">Season 1</span>
        <span className="ol-season-badge">{allTeams.length} teams</span>
        <button className="ol-btn ol-btn-small" onClick={handleRefresh} style={{ marginLeft: 'auto', padding: '4px 12px' }}>⟳</button>
      </div>

      <div className="ol-progress-bar">
        <div className="ol-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        <span className="ol-progress-label">Week {currentWeek} of {totalWeeks} ({finishedCount} matches played)</span>
      </div>

      {error && (
        <div className="ol-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ol-btn ol-btn-small">✕</button>
        </div>
      )}

      {hasHumanMatch && !physicsMatch && (
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
            Play Match
          </button>
        </div>
      )}

      {!hasHumanMatch && !simulating && pending.length > 0 && (
        <div className="ol-info-bar">
          <span>Week {currentWeek} — {pending.length} matches pending</span>
          <button onClick={handleForceSimulate} className="ol-btn ol-btn-small">
            Simulate Weeks
          </button>
        </div>
      )}

      {!hasHumanMatch && simulating && (
        <div className="ol-info-bar">
          <span className="ol-sim-spinner" />
          <span>Simulating matches...</span>
        </div>
      )}

      {!hasHumanMatch && !simulating && pending.length === 0 && (
        <div className="ol-info-bar">
          <span>All {finishedCount} matches played.</span>
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
