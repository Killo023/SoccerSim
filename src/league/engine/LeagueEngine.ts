import { Club, Fixture, FixtureResult, Standing, League } from '../types'
import { ALL_CLUBS } from '../data/clubs'

export function generateFixtures(clubs: Club[]): Fixture[] {
  const n = clubs.length
  const fixtures: Fixture[] = []
  let id = 0

  const ids = clubs.map(c => c.id)
  if (n % 2 !== 0) ids.push('BYE')

  const rounds = (ids.length - 1) * 2
  const half = ids.length / 2

  for (let r = 0; r < rounds; r++) {
    const week = r + 1
    for (let m = 0; m < half; m++) {
      const home = ids[m]
      const away = ids[ids.length - 1 - m]
      if (home === 'BYE' || away === 'BYE') continue
      const homeIdx = clubs.findIndex(c => c.id === home)
      const awayIdx = clubs.findIndex(c => c.id === away)
      if (homeIdx === -1 || awayIdx === -1) continue

      if (r < ids.length - 1) {
        fixtures.push({
          id: `f-${id++}`, week, homeClubId: home, awayClubId: away,
          result: null, played: false,
        })
      } else {
        fixtures.push({
          id: `f-${id++}`, week, homeClubId: away, awayClubId: home,
          result: null, played: false,
        })
      }
    }

    const last = ids.pop()!
    ids.splice(1, 0, last)
  }

  return fixtures.sort((a, b) => a.week - b.week)
}

export function computeStandings(clubs: Club[], fixtures: Fixture[]): Standing[] {
  const standingMap = new Map<string, Standing>()

  for (const club of clubs) {
    standingMap.set(club.id, {
      clubId: club.id, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, form: [],
    })
  }

  for (const f of fixtures) {
    if (!f.result) continue
    const home = standingMap.get(f.homeClubId)
    const away = standingMap.get(f.awayClubId)
    if (!home || !away) continue

    home.played++
    away.played++
    home.goalsFor += f.result.homeGoals
    home.goalsAgainst += f.result.awayGoals
    away.goalsFor += f.result.awayGoals
    away.goalsAgainst += f.result.homeGoals

    if (f.result.homeGoals > f.result.awayGoals) {
      home.won++; home.points += 3; home.form.push('W')
      away.lost++; away.form.push('L')
    } else if (f.result.homeGoals < f.result.awayGoals) {
      away.won++; away.points += 3; away.form.push('W')
      home.lost++; home.form.push('L')
    } else {
      home.drawn++; home.points++; home.form.push('D')
      away.drawn++; away.points++; away.form.push('D')
    }

    if (home.form.length > 5) home.form.shift()
    if (away.form.length > 5) away.form.shift()
  }

  const standings = Array.from(standingMap.values())
  for (const s of standings) {
    s.goalDiff = s.goalsFor - s.goalsAgainst
  }
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    return b.goalsFor - a.goalsFor
  })
  return standings
}

export function createLeague(clubs?: Club[]): League {
  const leagueClubs = clubs ?? ALL_CLUBS
  const fixtures = generateFixtures(leagueClubs)
  const standings = computeStandings(leagueClubs, fixtures)
  const totalWeeks = fixtures.reduce((max, f) => Math.max(max, f.week), 0)
  return {
    id: 'league',
    name: 'Premier Division',
    clubs: leagueClubs,
    fixtures,
    standings,
    currentWeek: 1,
    totalWeeks,
    seasonComplete: false,
  }
}

export function getWeekFixtures(league: League, week: number): Fixture[] {
  return league.fixtures.filter(f => f.week === week)
}

export function getClubById(league: League, clubId: string): Club | undefined {
  return league.clubs.find(c => c.id === clubId)
}

export function getClubStanding(standings: Standing[], clubId: string): Standing | undefined {
  return standings.find(s => s.clubId === clubId)
}

export function getClubForm(form: ('W' | 'D' | 'L')[]): string {
  return form.map(r => r === 'W' ? 'W' : r === 'D' ? 'D' : 'L').join('')
}

export function setFixtureResult(league: League, fixtureId: string, result: FixtureResult): void {
  const fixture = league.fixtures.find(f => f.id === fixtureId)
  if (!fixture || fixture.played) return
  fixture.result = result
  fixture.played = true
  league.standings = computeStandings(league.clubs, league.fixtures)
}

export function advanceWeek(league: League): boolean {
  if (league.seasonComplete) return false
  const nextWeek = league.currentWeek + 1
  const hasFixtures = league.fixtures.some(f => f.week === nextWeek)
  if (!hasFixtures) {
    league.seasonComplete = true
    return false
  }
  league.currentWeek = nextWeek
  return true
}

export function getLeagueProgress(league: League): number {
  const played = league.fixtures.filter(f => f.played).length
  const total = league.fixtures.length
  return total > 0 ? played / total : 0
}
