import { Club, Cup, CupRound, CupMatchup, FixtureResult } from '../types'
import { ALL_CLUBS } from '../data/clubs'

export function generateCup(clubs?: Club[]): Cup {
  const cupClubs = clubs ?? ALL_CLUBS.slice(0, 16)
  const shuffled = [...cupClubs].sort(() => Math.random() - 0.5)
  const rounds: CupRound[] = []
  let matchups = shuffled

  const roundNames = ['Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Final']
  let roundIndex = 0

  while (matchups.length >= 2) {
    const roundMatchups: CupMatchup[] = []
    for (let i = 0; i < matchups.length; i += 2) {
      const home = matchups[i]
      const away = matchups[i + 1]
      if (!away) {
        roundMatchups.push({
          homeClubId: home.id, awayClubId: home.id,
          result: null, played: true, winnerId: home.id,
        })
        continue
      }
      roundMatchups.push({
        homeClubId: home.id, awayClubId: away.id,
        result: null, played: false, winnerId: null,
      })
    }
    rounds.push({ name: roundNames[roundIndex] ?? `Round ${roundIndex + 1}`, matchups: roundMatchups })
    roundIndex++
    matchups = []
  }

  return {
    id: 'cup',
    name: 'FA Cup',
    clubs: cupClubs,
    rounds,
    currentRound: 0,
    complete: false,
  }
}

export function setCupMatchupResult(cup: Cup, roundIdx: number, matchupIdx: number, result: FixtureResult): void {
  const round = cup.rounds[roundIdx]
  if (!round) return
  const matchup = round.matchups[matchupIdx]
  if (!matchup || matchup.played) return

  matchup.result = result
  matchup.played = true
  matchup.winnerId = result.homeGoals > result.awayGoals ? matchup.homeClubId : matchup.awayClubId

  const nextRound = cup.rounds[roundIdx + 1]
  if (nextRound) {
    const nextMatchupIdx = Math.floor(matchupIdx / 2)
    const nextMatchup = nextRound.matchups[nextMatchupIdx]
    if (nextMatchup) {
      if (matchupIdx % 2 === 0) {
        nextMatchup.homeClubId = matchup.winnerId
      } else {
        nextMatchup.awayClubId = matchup.winnerId
      }
    }
  }
}

export function advanceCupRound(cup: Cup): boolean {
  if (cup.complete) return false
  const current = cup.rounds[cup.currentRound]
  if (!current) { cup.complete = true; return false }
  const allPlayed = current.matchups.every(m => m.played)
  if (!allPlayed) return false
  if (cup.currentRound >= cup.rounds.length - 1) {
    cup.complete = true
    return false
  }
  cup.currentRound++
  return true
}

export function getCupProgress(cup: Cup): number {
  let played = 0
  let total = 0
  for (const round of cup.rounds) {
    for (const m of round.matchups) {
      total++
      if (m.played) played++
    }
  }
  return total > 0 ? played / total : 0
}
