import { Player, Position } from '../types'
import { seedFromString } from '../rng'
import type { SquadRatings } from '../../multiplayer/fantasyManagers'

/* ------------------------------------------------------------------ *
 * Deterministic statistical match simulator for the online PvP match. *
 * Produces the full narrative report (prediction, minute-by-minute    *
 * events, goals by real players, match stats, player of the match).   *
 *                                                                     *
 * The result is driven by team quality (unit ratings), chemistry,     *
 * system proficiency and seeded randomness, so both online clients    *
 * compute identical reports and the stronger / better-linked team is  *
 * more likely to win — but upsets are possible.                       *
 * ------------------------------------------------------------------ */

export interface NarrativeTeamInfo {
  name: string
  shortName: string
  color: string
  managerName: string
  formation: string
  players: Player[]
  ratings: SquadRatings
  /** 0-100 nationality chemistry score (0 when not a fantasy team). */
  chemistry: number
  /** 0-100 system proficiency score. */
  system: number
}

export type NarrativeEventType =
  | 'kickoff' | 'goal' | 'save' | 'shot' | 'chance' | 'corner'
  | 'tactical' | 'sub' | 'half' | 'fulltime'

export interface NarrativeEvent {
  minute: number
  type: NarrativeEventType
  team: 'home' | 'away' | null
  text: string
  /** Current score [home, away] when the event changed it. */
  score?: [number, number]
}

export interface NarrativeGoal {
  team: 'home' | 'away'
  player: string
  minute: number
  assist?: string
}

export interface NarrativeStats {
  possession: [number, number]
  shots: [number, number]
  shotsOnTarget: [number, number]
  xg: [number, number]
  corners: [number, number]
  passAccuracy: [number, number]
}

export interface NarrativeMatchReport {
  home: NarrativeTeamInfo
  away: NarrativeTeamInfo
  prediction: {
    home: number
    draw: number
    away: number
    summary: string[]
  }
  events: NarrativeEvent[]
  homeGoals: number
  awayGoals: number
  scorers: NarrativeGoal[]
  stats: NarrativeStats
  potm: {
    player: string
    team: 'home' | 'away'
    goals: number
    assists: number
    shots: number
    rating: number
  }
}

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function poissonPmf(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) result *= lambda / i
  return result
}

function winProbabilities(lambdaH: number, lambdaA: number): { home: number; draw: number; away: number } {
  let home = 0
  let draw = 0
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = poissonPmf(lambdaH, i) * poissonPmf(lambdaA, j)
      if (i > j) home += p
      else if (i === j) draw += p
    }
  }
  const away = 1 - home - draw
  const total = home + draw + away
  return {
    home: Math.round((home / total) * 100),
    draw: Math.round((draw / total) * 100),
    away: Math.round((away / total) * 100),
  }
}

interface Powers {
  attack: number
  midfield: number
  defence: number
  gk: number
}

function teamPowers(t: NarrativeTeamInfo): Powers {
  const chemF = 1 + (t.chemistry / 100) * 0.16
  const sysF = 1 + (t.system / 100) * 0.12
  const r = t.ratings
  return {
    attack: (r.attack * 0.7 + r.midfield * 0.3) * chemF * sysF,
    midfield: r.midfield * chemF * sysF,
    defence: (r.defence * 0.75 + r.goalkeeper * 0.25) * chemF * sysF,
    gk: r.goalkeeper,
  }
}

const NORM = 86

const SCORER_WEIGHT: Record<Position, number> = {
  ST: 1.5, LW: 1.25, RW: 1.25, CAM: 1.05, LM: 0.9, RM: 0.9,
  CM: 0.65, CDM: 0.35, CB: 0.3, LB: 0.35, RB: 0.35, GK: 0,
}

const ASSIST_WEIGHT: Record<Position, number> = {
  CAM: 1.35, CM: 1.2, LM: 1.1, RM: 1.1, LW: 1.0, RW: 1.0,
  CDM: 0.9, ST: 0.8, LB: 0.7, RB: 0.7, CB: 0.4, GK: 0,
}

function weightedPick(players: Player[], weightFor: (p: Player) => number, rng: () => number): Player {
  let total = 0
  const weights = players.map(p => {
    const w = Math.max(0.01, weightFor(p))
    total += w
    return w
  })
  let roll = rng() * total
  for (let i = 0; i < players.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return players[i]
  }
  return players[players.length - 1]
}

function bestPlayer(players: Player[], weightFor: (p: Player) => number): Player {
  let best: Player | null = null
  let bestW = -Infinity
  for (const p of players) {
    const w = weightFor(p)
    if (w > bestW) { bestW = w; best = p }
  }
  return best!
}

interface Perf {
  goals: number
  assists: number
  shots: number
  onTarget: number
  position: Position
}

export function simulateNarrativeMatch(home: NarrativeTeamInfo, away: NarrativeTeamInfo): NarrativeMatchReport {
  const rng = mulberry32(seedFromString(`narrative:${home.name}|${away.name}|${home.managerName}|${away.managerName}`))

  const pH = teamPowers(home)
  const pA = teamPowers(away)

  const lambdaH = clamp(1.4 * ((pH.attack / NORM) / (pA.defence / NORM)) * 1.07, 0.15, 3.6)
  const lambdaA = clamp(1.4 * ((pA.attack / NORM) / (pH.defence / NORM)) * 0.93, 0.15, 3.6)

  const probs = winProbabilities(lambdaH, lambdaA)

  // Possession split — midfield dominance + a small home advantage.
  const homePoss = clamp(Math.round(50 + (pH.midfield - pA.midfield) * 0.5 + 1.5), 38, 62)

  // Pre-match prediction summary (mirrors the example report).
  const summary: string[] = []
  const gkDiff = pH.gk - pA.gk
  const chemDiff = home.chemistry - away.chemistry
  const midDiff = pH.midfield - pA.midfield
  const attDiff = pH.attack - pA.attack
  if (Math.abs(gkDiff) >= 2) summary.push(gkDiff > 0
    ? `${home.name} have the stronger goalkeeper.`
    : `${away.name} have the stronger goalkeeper.`)
  if (Math.abs(chemDiff) >= 10) summary.push(chemDiff > 0
    ? `${home.name} have significantly higher chemistry.`
    : `${away.name} have significantly higher chemistry.`)
  else if (Math.abs(chemDiff) >= 5) summary.push(chemDiff > 0
    ? `${home.name} hold the chemistry edge.`
    : `${away.name} hold the chemistry edge.`)
  if (home.system >= 90 && away.system >= 90) summary.push('Both teams have perfect tactical fit.')
  else if (Math.abs(home.system - away.system) >= 15) summary.push(home.system > away.system
    ? `${home.name} fit their tactical system better.`
    : `${away.name} fit their tactical system better.`)
  if (Math.abs(midDiff) >= 3) summary.push(midDiff > 0
    ? `${home.name} boast the stronger midfield and should control possession.`
    : `${away.name} boast the stronger midfield and should control possession.`)
  else summary.push('The midfields are evenly matched — expect a tight, contested battle.')
  if (Math.abs(attDiff) >= 2) summary.push(attDiff > 0
    ? `${home.name}'s attack carries the greater threat.`
    : `${away.name}'s attack carries the greater threat.`)
  const homeStar = bestPlayer(home.players, p => (SCORER_WEIGHT[p.position] ?? 0.5) * p.attrs.shooting)
  const awayStar = bestPlayer(away.players, p => (SCORER_WEIGHT[p.position] ?? 0.5) * p.attrs.shooting)
  summary.push(`Keep an eye on ${homeStar.name} and ${awayStar.name} — both can decide the game in a moment.`)

  // Stats accumulators
  let hGoals = 0
  let aGoals = 0
  let hShots = 0
  let aShots = 0
  let hSot = 0
  let aSot = 0
  let hXg = 0
  let aXg = 0
  let hCorners = 0
  let aCorners = 0

  const perf = new Map<string, Perf>()
  const touch = (p: Player) => {
    const cur = perf.get(p.id) ?? { goals: 0, assists: 0, shots: 0, onTarget: 0, position: p.position }
    perf.set(p.id, cur)
    return cur
  }

  const events: NarrativeEvent[] = []
  const scorers: NarrativeGoal[] = []
  const score = (): [number, number] => [hGoals, aGoals]

  const expShotsH = lambdaH * 6.5
  const expShotsA = lambdaA * 6.5

  // Expected corner count (flavour).
  const expCornersH = clamp(Math.round(lambdaH * 2.7), 2, 8)
  const expCornersA = clamp(Math.round(lambdaA * 2.7), 2, 8)

  const savePFor = (info: NarrativeTeamInfo) => clamp(0.8 - (info.ratings.goalkeeper - 86) * 0.012, 0.55, 0.92)

  const shootFor = (team: 'home' | 'away', minute: number) => {
    const info = team === 'home' ? home : away
    const opp = team === 'home' ? away : home
    const powers = team === 'home' ? pH : pA
    const oppPowers = team === 'home' ? pA : pH
    const onTargetP = clamp(0.58 * (powers.attack / oppPowers.defence), 0.42, 0.72)
    const shooter = weightedPick(
      info.players.filter(p => p.position !== 'GK'),
      p => (SCORER_WEIGHT[p.position] ?? 0.5) * (p.attrs.shooting / 90),
      rng,
    )
    const stat = touch(shooter)
    stat.shots++

    const onTarget = rng() < onTargetP
    const goalP = onTargetP * (1 - savePFor(opp))
    if (team === 'home') { hShots++; hXg += goalP } else { aShots++; aXg += goalP }

    if (onTarget) {
      if (team === 'home') hSot++; else aSot++
      stat.onTarget++
      const saveP = savePFor(opp)
      const saved = rng() < saveP
      if (saved) {
        const gk = opp.players.find(p => p.position === 'GK')
        events.push({
          minute, type: 'save', team: opp.name === home.name ? 'home' : 'away',
          text: `🧤 ${gk?.name ?? 'The keeper'} palms away ${shooter.name}'s effort for ${info.name}.`,
        })
      } else {
        // GOAL
        const assister = weightedPick(
          info.players.filter(p => p.id !== shooter.id && p.position !== 'GK'),
          p => (ASSIST_WEIGHT[p.position] ?? 0.5) * (p.attrs.passing / 90),
          rng,
        )
        const assistStat = touch(assister)
        assistStat.assists++
        stat.goals++
        if (team === 'home') hGoals++; else aGoals++
        scorers.push({ team, player: shooter.name, minute, assist: assister.name })
        events.push({
          minute, type: 'goal', team,
          text: `⚽ GOAL! ${shooter.name} scores for ${info.name} — great work from ${assister.name}! (${hGoals}-${aGoals})`,
          score: score(),
        })
        // ~40% chance the conceding manager reacts tactically.
        if (rng() < 0.4 && minute < 88) {
          events.push({
            minute: minute + 1, type: 'tactical', team: opp.name === home.name ? 'home' : 'away',
            text: `${opp.managerName} reacts — higher press, more attacking mentality.`,
          })
        }
      }
    } else {
      // Off target — occasionally surface in the feed.
      if (rng() < 0.35) {
        events.push({
          minute, type: 'shot', team,
          text: `${shooter.name} fires just ${rng() < 0.5 ? 'wide' : 'over'} for ${info.name}.`,
        })
      }
    }
  }

  events.push({ minute: 1, type: 'kickoff', team: 'home', text: `Kickoff! ${home.name} get us underway against ${away.name}.` })

  const subMinute = 60 + Math.floor(rng() * 15)

  for (let minute = 1; minute <= 90; minute++) {
    const attacking: 'home' | 'away' = rng() < homePoss / 100 ? 'home' : 'away'
    const expShots = attacking === 'home' ? expShotsH : expShotsA
    const shotP = expShots / 90

    if (rng() < shotP) {
      shootFor(attacking, minute)
    } else if (rng() < 0.018) {
      // Flavour chance / corner.
      const info = attacking === 'home' ? home : away
      const player = weightedPick(info.players.filter(p => p.position !== 'GK'), p => p.attrs.dribbling, rng)
      if (rng() < 0.5) {
        if (attacking === 'home') hCorners++; else aCorners++
        events.push({ minute, type: 'corner', team: attacking, text: `Corner for ${info.name}...` })
      } else {
        const defendingName = attacking === 'home' ? away.name : home.name
        events.push({ minute, type: 'chance', team: attacking, text: `${player.name} drives at the ${defendingName} defence...` })
      }
    }

    if (minute === subMinute) {
      const info = rng() < 0.5 ? home : away
      const off = weightedPick(info.players.filter(p => p.position !== 'GK'), p => 1 / (1 + (p.attrs.physical / 90)), rng)
      const on = weightedPick(info.players.filter(p => p.position !== 'GK'), p => p.attrs.pace, rng)
      if (off.id !== on.id) {
        events.push({ minute, type: 'sub', team: info === home ? 'home' : 'away', text: `🔄 Substitution — ${off.name} OFF, ${on.name} ON with fresh legs for ${info.name}.` })
      }
    }

    if (minute === 45) {
      events.push({ minute: 45, type: 'half', team: null, text: `Half time! ${home.name} ${hGoals} - ${aGoals} ${away.name}.` })
    }
  }

  events.push({ minute: 90, type: 'fulltime', team: null, text: `Full time! ${home.name} ${hGoals} - ${aGoals} ${away.name}.` })

  // Corner stat — use the deterministic expected value, rounded to the feed.
  hCorners = Math.max(hCorners, expCornersH)
  aCorners = Math.max(aCorners, expCornersA)

  // Pass accuracy — midfield quality + possession.
  const hPass = clamp(Math.round(83 + (pH.midfield - NORM) * 0.7 + (homePoss - 50) * 0.12), 75, 93)
  const aPass = clamp(Math.round(83 + (pA.midfield - NORM) * 0.7 + ((100 - homePoss) - 50) * 0.12), 75, 93)

  // Player of the match — weighted by goals, assists, shots.
  let potmPlayer: Player | null = null
  let potmScore = -Infinity
  const winner: 'home' | 'away' | 'draw' = hGoals > aGoals ? 'home' : aGoals > hGoals ? 'away' : 'draw'
  for (const [id, p] of perf) {
    if (p.position === 'GK' && p.goals === 0 && p.onTarget === 0) continue
    const inWinning = winner === 'draw' ? true : winner === (home.players.some(pl => pl.id === id) ? 'home' : 'away')
    const s = p.goals * 2.5 + p.assists * 1.5 + p.shots * 0.15 + p.onTarget * 0.2 + (inWinning ? 0.6 : 0)
    if (s > potmScore) {
      potmScore = s
      potmPlayer = home.players.find(pl => pl.id === id) ?? away.players.find(pl => pl.id === id) ?? null
    }
  }
  if (!potmPlayer) {
    // Clean-sheet / no-event game — credit the better keeper or top star.
    potmPlayer = pH.gk >= pA.gk ? bestPlayer(home.players, p => p.position === 'GK' ? 1 : 0) : bestPlayer(away.players, p => p.position === 'GK' ? 1 : 0)
    potmScore = 1
  }
  const potmPerf = perf.get(potmPlayer.id) ?? { goals: 0, assists: 0, shots: 0, onTarget: 0, position: potmPlayer.position }
  const potmRating = Math.min(9.9, Math.round((6.2 + Math.max(0.8, potmScore) * 0.55) * 10) / 10)
  const potmTeam: 'home' | 'away' = home.players.some(p => p.id === potmPlayer!.id) ? 'home' : 'away'

  return {
    home,
    away,
    prediction: { home: probs.home, draw: probs.draw, away: probs.away, summary },
    events,
    homeGoals: hGoals,
    awayGoals: aGoals,
    scorers,
    stats: {
      possession: [homePoss, 100 - homePoss],
      shots: [hShots, aShots],
      shotsOnTarget: [hSot, aSot],
      xg: [Math.round(hXg * 10) / 10, Math.round(aXg * 10) / 10],
      corners: [hCorners, aCorners],
      passAccuracy: [hPass, aPass],
    },
    potm: {
      player: potmPlayer.name,
      team: potmTeam,
      goals: potmPerf.goals,
      assists: potmPerf.assists,
      shots: potmPerf.shots,
      rating: potmRating,
    },
  }
}
