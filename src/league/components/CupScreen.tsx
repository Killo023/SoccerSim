import { useState } from 'react'
import { useLeagueStore } from '../../store/leagueStore'
import { setCupMatchupResult, advanceCupRound, getCupProgress, generateCup as genCup } from '../engine/CupEngine'
import { clubToTeamData } from '../../match/engine/TeamConverter'
import { fastSimulate } from '../../match/engine/FastSimulator'
import { MatchView } from '../../match/components/MatchView'
import { CupBracket } from './CupBracket'

export function CupScreen() {
  const cup = useLeagueStore(s => s.cup)
  const setCup = useLeagueStore(s => s.setCup)
  const setView = useLeagueStore(s => s.setView)
  const [simming, setSimming] = useState(false)
  const [watchingMatch, setWatchingMatch] = useState<{ homeId: string; awayId: string } | null>(null)

  const currentRound = cup.rounds[cup.currentRound]
  const allPlayed = currentRound?.matchups.every(m => m.played) ?? false
  const clubs = cup.clubs

  const simRound = async () => {
    if (!currentRound) return
    setSimming(true)
    for (let mi = 0; mi < currentRound.matchups.length; mi++) {
      const m = currentRound.matchups[mi]
      if (m.played || m.homeClubId === m.awayClubId) continue
      const homeClub = clubs.find(c => c.id === m.homeClubId)
      const awayClub = clubs.find(c => c.id === m.awayClubId)
      if (!homeClub || !awayClub) continue
      const homeTeam = clubToTeamData(homeClub, 'home')
      const awayTeam = clubToTeamData(awayClub, 'away')
      const result = fastSimulate(homeTeam, awayTeam)
      setCupMatchupResult(cup, cup.currentRound, mi, result)
    }
    setCup({ ...cup })
    setSimming(false)
  }

  const advance = () => {
    advanceCupRound(cup)
    setCup({ ...cup })
  }

  if (watchingMatch) {
    const homeClub = clubs.find(c => c.id === watchingMatch.homeId)
    const awayClub = clubs.find(c => c.id === watchingMatch.awayId)
    if (!homeClub || !awayClub) return null
    return (
      <div className="match-screen">
        <div className="match-main">
          <div className="match-canvas-container">
            <MatchView homeTeam={clubToTeamData(homeClub, 'home')} awayTeam={clubToTeamData(awayClub, 'away')} />
          </div>
        </div>
        <div className="match-bar">
          <button className="ctrl-btn" onClick={() => setWatchingMatch(null)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cup-screen">
      <CupBracket />
      <div className="cup-actions">
        {currentRound && !allPlayed && (
          <button className="action-btn primary" onClick={simRound} disabled={simming}>
            {simming ? 'Simulating...' : `Simulate ${currentRound.name}`}
          </button>
        )}
        {allPlayed && !cup.complete && (
          <button className="action-btn secondary" onClick={advance}>
            Next Round
          </button>
        )}
        {cup.complete && (
          <div className="cup-winner">
            <p>Tournament Complete!</p>
            <button className="action-btn primary" onClick={() => {
              useLeagueStore.getState().setCup(genCup())
            }}>New Tournament</button>
          </div>
        )}
        <div className="cup-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${getCupProgress(cup) * 100}%` }} />
          </div>
          <span>{Math.round(getCupProgress(cup) * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
