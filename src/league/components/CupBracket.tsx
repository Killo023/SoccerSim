import { useLeagueStore } from '../../store/leagueStore'
import { getClubById } from '../engine/LeagueEngine'

export function CupBracket() {
  const cup = useLeagueStore(s => s.cup)
  const league = useLeagueStore(s => s.league)
  const setView = useLeagueStore(s => s.setView)

  const clubs = cup.clubs.length > 0 ? cup.clubs : league.clubs

  return (
    <div className="cup-container">
      <div className="panel-header">
        <button className="back-btn" onClick={() => setView('menu')}>Back</button>
        <h2>{cup.name}</h2>
      </div>
      <div className="cup-bracket">
        {cup.rounds.map((round, ri) => (
          <div key={ri} className="cup-round">
            <h3 className="round-name">{round.name}</h3>
            <div className="cup-matchups">
              {round.matchups.map((m, mi) => {
                const home = clubs.find(c => c.id === m.homeClubId)
                const away = clubs.find(c => c.id === m.awayClubId)
                return (
                  <div key={mi} className={`cup-matchup ${m.played ? 'played' : ''} ${m.winnerId ? 'decided' : ''}`}>
                    <div className={`cup-team ${m.winnerId === m.homeClubId ? 'winner' : ''}`}>
                      <span className="team-badge-xs" style={{ background: home?.color }} />
                      <span>{home?.shortName ?? 'TBD'}</span>
                      {m.played && <span className="cup-score">{m.result!.homeGoals}</span>}
                    </div>
                    <div className={`cup-team ${m.winnerId === m.awayClubId ? 'winner' : ''}`}>
                      <span className="team-badge-xs" style={{ background: away?.color }} />
                      <span>{away?.shortName ?? 'TBD'}</span>
                      {m.played && <span className="cup-score">{m.result!.awayGoals}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
