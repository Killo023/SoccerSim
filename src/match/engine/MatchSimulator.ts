import { TeamData } from '../types'
import { FixtureResult } from '../../league/types'
import { MatchEngine } from './MatchEngine'
import { MATCH_DURATION } from '../constants'

export function simulateMatch(homeTeam: TeamData, awayTeam: TeamData): Promise<FixtureResult> {
  return new Promise((resolve) => {
    const engine = new MatchEngine({
      homeTeam,
      awayTeam,
      onStateUpdate: (state) => {
        if (state.status === 'finished') {
          engine.destroy()
          resolve({
            homeGoals: state.stats.homeGoals,
            awayGoals: state.stats.awayGoals,
            homeShots: state.stats.homeShots,
            awayShots: state.stats.awayShots,
            homeShotsOnTarget: state.stats.homeShotsOnTarget,
            awayShotsOnTarget: state.stats.awayShotsOnTarget,
            homePossession: Math.round(state.stats.homePossession),
          })
        }
      },
    })
    engine.setSpeed(4)
    engine.start()
  })
}
