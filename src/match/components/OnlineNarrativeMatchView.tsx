import { useEffect, useRef, useState, useCallback } from 'react'
import { TeamData } from '../types'
import { NarrativeMatchReport, NarrativeEvent } from '../engine/NarrativeSimulator'

interface Props {
  homeTeam: TeamData
  awayTeam: TeamData
  report: NarrativeMatchReport
  onFinish: () => void
  onWatch2D: () => void
}

type Phase = 'prediction' | 'live' | 'fulltime'

function ComparisonRow({ label, a, b }: { label: string; a: number; b: number }) {
  const aWins = a > b
  const bWins = b > a
  const isSpecial = label === 'Chemistry' || label === 'System'
  return (
    <tr>
      <td className={`nm-comp-val ${aWins ? 'nm-strong' : ''}`}>{a}</td>
      <td className="nm-comp-label">{isSpecial ? label : label + ' Rating'}</td>
      <td className={`nm-comp-val ${bWins ? 'nm-strong' : ''}`}>{b}</td>
    </tr>
  )
}

export function OnlineNarrativeMatchView({ homeTeam, awayTeam, report, onFinish, onWatch2D }: Props) {
  const [phase, setPhase] = useState<Phase>('prediction')
  const [visibleCount, setVisibleCount] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const feedRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  const { home, away } = report
  const totalEvents = report.events.length

  // Current score while the feed plays.
  const visibleEvents = report.events.slice(0, visibleCount)
  let liveHome = 0
  let liveAway = 0
  for (const e of visibleEvents) {
    if (e.type === 'goal') {
      if (e.team === 'home') liveHome++
      else liveAway++
    }
  }

  const tick = useCallback(() => {
    setVisibleCount(prev => {
      if (prev >= totalEvents) {
        setPlaying(false)
        return prev
      }
      return prev + 1
    })
  }, [totalEvents])

  useEffect(() => {
    if (!playing || visibleCount >= totalEvents) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const delay = 1500 / speed
    timerRef.current = window.setTimeout(tick, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, visibleCount, totalEvents, speed, tick])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [visibleCount])

  useEffect(() => {
    if (phase === 'live' && visibleCount >= totalEvents) {
      const t = window.setTimeout(() => setPhase('fulltime'), 900)
      return () => clearTimeout(t)
    }
  }, [phase, visibleCount, totalEvents])

  const eventClass = (e: NarrativeEvent) => {
    if (e.type === 'goal') return 'nm-event nm-goal'
    if (e.type === 'half') return 'nm-event nm-break'
    if (e.type === 'fulltime') return 'nm-event nm-ft'
    if (e.type === 'tactical' || e.type === 'sub') return 'nm-event nm-tactical'
    if (e.type === 'save') return 'nm-event nm-save'
    return 'nm-event'
  }

  const prediction = report.prediction
  const oddsTotal = prediction.home + prediction.draw + prediction.away

  if (phase === 'prediction') {
    return (
      <div className="nm-screen">
        <div className="nm-header">
          <span className="nm-kickoff-badge">Match Preview</span>
        </div>
        <div className="nm-scroll">
          <div className="nm-fixture">
            <div className="nm-team-head" style={{ borderColor: home.color }}>
              <span className="nm-team-name">{home.name}</span>
              <span className="nm-manager-name">{home.managerName}</span>
              <span className="nm-formation">{home.formation}</span>
            </div>
            <div className="nm-vs-badge">VS</div>
            <div className="nm-team-head" style={{ borderColor: away.color }}>
              <span className="nm-team-name">{away.name}</span>
              <span className="nm-manager-name">{away.managerName}</span>
              <span className="nm-formation">{away.formation}</span>
            </div>
          </div>

          <h3 className="nm-section-title">Team Comparison</h3>
          <table className="nm-comp-table">
            <thead>
              <tr>
                <th>{home.name}</th>
                <th></th>
                <th>{away.name}</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Attack" a={home.ratings.attack} b={away.ratings.attack} />
              <ComparisonRow label="Midfield" a={home.ratings.midfield} b={away.ratings.midfield} />
              <ComparisonRow label="Defence" a={home.ratings.defence} b={away.ratings.defence} />
              <ComparisonRow label="Goalkeeper" a={home.ratings.goalkeeper} b={away.ratings.goalkeeper} />
              <ComparisonRow label="Chemistry" a={home.chemistry} b={away.chemistry} />
              <ComparisonRow label="System" a={home.system} b={away.system} />
            </tbody>
          </table>

          <h3 className="nm-section-title">Predicted Outcome</h3>
          <div className="nm-odds">
            <div className="nm-odds-row">
              <span className="nm-odds-team" style={{ color: home.color }}>{home.name}</span>
              <div className="nm-odds-track">
                <div className="nm-odds-fill nm-odds-home" style={{ width: `${(prediction.home / oddsTotal) * 100}%` }} />
              </div>
              <span className="nm-odds-val">{prediction.home}%</span>
            </div>
            <div className="nm-odds-row">
              <span className="nm-odds-team nm-odds-draw-label">Draw</span>
              <div className="nm-odds-track">
                <div className="nm-odds-fill nm-odds-draw" style={{ width: `${(prediction.draw / oddsTotal) * 100}%` }} />
              </div>
              <span className="nm-odds-val">{prediction.draw}%</span>
            </div>
            <div className="nm-odds-row">
              <span className="nm-odds-team" style={{ color: away.color }}>{away.name}</span>
              <div className="nm-odds-track">
                <div className="nm-odds-fill nm-odds-away" style={{ width: `${(prediction.away / oddsTotal) * 100}%` }} />
              </div>
              <span className="nm-odds-val">{prediction.away}%</span>
            </div>
          </div>

          <h3 className="nm-section-title">Pre-match Analysis</h3>
          <ul className="nm-summary">
            {prediction.summary.map((s, i) => <li key={i}>{s}</li>)}
          </ul>

          <div className="nm-actions">
            <button className="nm-btn nm-btn-primary" onClick={() => { setPhase('live'); setVisibleCount(0); setPlaying(true) }}>
              ▶ Kick Off
            </button>
            <button className="nm-btn" onClick={onWatch2D}>
              Watch in 2D
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'live') {
    return (
      <div className="nm-screen">
        <div className="nm-scoreboard">
          <div className="nm-score-team" style={{ borderColor: home.color }}>
            <span className="nm-score-name">{homeTeam.shortName}</span>
            <span className="nm-score-num">{liveHome}</span>
          </div>
          <div className="nm-score-vs">vs</div>
          <div className="nm-score-team" style={{ borderColor: away.color }}>
            <span className="nm-score-num">{liveAway}</span>
            <span className="nm-score-name">{awayTeam.shortName}</span>
          </div>
        </div>

        <div className="nm-feed" ref={feedRef}>
          {visibleCount === 0 && (
            <div className="nm-event nm-kickoff">
              <span className="nm-minute">0'</span>
              <span className="nm-desc">The match is underway! {home.name} kick off.</span>
            </div>
          )}
          {report.events.slice(0, visibleCount).map((e, i) => (
            <div key={i} className={eventClass(e)}>
              <span className="nm-minute">{e.minute}'</span>
              <span className="nm-desc">{e.text}</span>
              {e.type === 'goal' && <span className="nm-goal-icon">⚽</span>}
            </div>
          ))}
          {visibleCount >= totalEvents && (
            <div className="nm-finished">
              <span className="nm-ft-text">Full Time</span>
              <div className="nm-ft-score">
                <span style={{ color: home.color }}>{homeTeam.shortName}</span>
                <span className="nm-ft-num">{liveHome} - {liveAway}</span>
                <span style={{ color: away.color }}>{awayTeam.shortName}</span>
              </div>
            </div>
          )}
        </div>

        <div className="nm-controls">
          {visibleCount < totalEvents && (
            <button className="ctrl-btn" onClick={() => setPlaying(!playing)}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
          )}
          {visibleCount < totalEvents && (
            <div className="nm-speed">
              {[1, 2, 4].map(s => (
                <button key={s} className={`ctrl-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>{s}x</button>
              ))}
            </div>
          )}
          {visibleCount < totalEvents && (
            <button className="ctrl-btn" onClick={() => setVisibleCount(totalEvents)}>⏩ Skip to End</button>
          )}
          {visibleCount >= totalEvents && (
            <button className="nm-btn nm-btn-primary" onClick={() => setPhase('fulltime')}>View Report</button>
          )}
        </div>
      </div>
    )
  }

  // fulltime report
  const isDraw = report.homeGoals === report.awayGoals
  const homeWon = report.homeGoals > report.awayGoals
  const winnerName = isDraw ? 'It\'s a Draw' : (homeWon ? home.name : away.name)
  const winnerColor = isDraw ? '#f1c40f' : (homeWon ? home.color : away.color)

  return (
    <div className="nm-screen">
      <div className="nm-header">
        <span className="nm-kickoff-badge">Full Time</span>
      </div>
      <div className="nm-scroll">
        <div className="nm-result-card">
          <span className="nm-result-winner" style={{ color: winnerColor }}>{winnerName}</span>
          <div className="nm-result-score">
            <span style={{ color: home.color }}>{home.name}</span>
            <span className="nm-result-num">{report.homeGoals} - {report.awayGoals}</span>
            <span style={{ color: away.color }}>{away.name}</span>
          </div>
        </div>

        <h3 className="nm-section-title">Goals</h3>
        {report.scorers.length === 0 ? (
          <p className="nm-empty">No goals — a hard-fought 0-0.</p>
        ) : (
          <div className="nm-goals">
            {report.scorers.map((g, i) => (
              <div key={i} className={`nm-goal-row ${g.team === 'home' ? 'nm-goal-home' : 'nm-goal-away'}`}>
                <span className="nm-goal-minute">{g.minute}'</span>
                <span className="nm-goal-player">{g.player}</span>
                {g.assist && <span className="nm-goal-assist">assist {g.assist}</span>}
                <span className="nm-goal-team">{g.team === 'home' ? home.name : away.name}</span>
              </div>
            ))}
          </div>
        )}

        <h3 className="nm-section-title">Match Stats</h3>
        <table className="nm-comp-table nm-stats">
          <tbody>
            <tr><td className="nm-stat-val">{report.stats.possession[0]}%</td><td className="nm-comp-label">Possession</td><td className="nm-stat-val">{report.stats.possession[1]}%</td></tr>
            <tr><td className="nm-stat-val">{report.stats.shots[0]}</td><td className="nm-comp-label">Shots</td><td className="nm-stat-val">{report.stats.shots[1]}</td></tr>
            <tr><td className="nm-stat-val">{report.stats.shotsOnTarget[0]}</td><td className="nm-comp-label">Shots on Target</td><td className="nm-stat-val">{report.stats.shotsOnTarget[1]}</td></tr>
            <tr><td className="nm-stat-val">{report.stats.xg[0]}</td><td className="nm-comp-label">Expected Goals</td><td className="nm-stat-val">{report.stats.xg[1]}</td></tr>
            <tr><td className="nm-stat-val">{report.stats.corners[0]}</td><td className="nm-comp-label">Corners</td><td className="nm-stat-val">{report.stats.corners[1]}</td></tr>
            <tr><td className="nm-stat-val">{report.stats.passAccuracy[0]}%</td><td className="nm-comp-label">Pass Accuracy</td><td className="nm-stat-val">{report.stats.passAccuracy[1]}%</td></tr>
          </tbody>
        </table>

        <h3 className="nm-section-title">Player of the Match</h3>
        <div className="nm-potm">
          <span className="nm-potm-star">⭐</span>
          <div className="nm-potm-info">
            <span className="nm-potm-name">{report.potm.player}</span>
            <span className="nm-potm-team" style={{ color: report.potm.team === 'home' ? home.color : away.color }}>
              {report.potm.team === 'home' ? home.name : away.name}
            </span>
            <span className="nm-potm-stat">
              {report.potm.goals} goal{report.potm.goals === 1 ? '' : 's'} · {report.potm.assists} assist{report.potm.assists === 1 ? '' : 's'} · {report.potm.shots} shots
            </span>
          </div>
          <span className="nm-potm-rating">{report.potm.rating}</span>
        </div>

        <div className="nm-actions">
          <button className="nm-btn nm-btn-primary" onClick={onFinish}>Continue</button>
          <button className="nm-btn" onClick={onWatch2D}>Watch 2D Replay</button>
        </div>
      </div>
    </div>
  )
}
