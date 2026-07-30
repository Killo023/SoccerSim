import { useMatchStore } from '../../store/matchStore'

export function MatchEndOverlay() {
  const matchState = useMatchStore(s => s.matchState)
  if (!matchState || matchState.status !== 'finished') return null

  const s = matchState.stats
  const homeWins = s.homeGoals > s.awayGoals
  const awayWins = s.awayGoals > s.homeGoals
  const draw = s.homeGoals === s.awayGoals

  return (
    <div className="match-end-overlay">
      <div className="match-end-backdrop" />
      <div className="match-end-content">
        <div className="match-end-ft">Full Time</div>
        <div className="match-end-score">
          <span className="match-end-goal home">{s.homeGoals}</span>
          <span className="match-end-dash">-</span>
          <span className="match-end-goal away">{s.awayGoals}</span>
        </div>
        <div className={`match-end-result ${homeWins ? 'home-win' : awayWins ? 'away-win' : 'draw'}`}>
          {draw ? 'Draw' : `${homeWins ? 'Home' : 'Away'} Wins!`}
        </div>
        <div className="match-end-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="match-end-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1.5 + Math.random() * 2}s`,
                background: homeWins ? '#3498db' : awayWins ? '#e74c3c' : '#f1c40f',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
