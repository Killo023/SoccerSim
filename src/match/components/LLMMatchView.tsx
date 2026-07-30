import { useState, useEffect, useRef, useCallback } from 'react'
import { TeamData, MatchEvent } from '../types'
import { LLMEvent } from '../engine/LLMSimulator'

interface Props {
  homeTeam: TeamData
  awayTeam: TeamData
  events: MatchEvent[]
  llmEvents: LLMEvent[]
  homeGoals: number
  awayGoals: number
  onFinish: () => void
}

export function LLMMatchView({ homeTeam, awayTeam, events, llmEvents, homeGoals, awayGoals, onFinish }: Props) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const feedRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  const totalEvents = events.length

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
    const delay = 1800 / speed
    timerRef.current = window.setTimeout(tick, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, visibleCount, totalEvents, speed, tick])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [visibleCount])

  const isFinished = visibleCount >= totalEvents

  return (
    <div className="llm-match">
      <div className="llm-scoreboard">
        <div className="llm-team llm-home" style={{ borderColor: homeTeam.color }}>
          <span className="llm-team-name">{homeTeam.shortName}</span>
          <span className="llm-team-score">{homeGoals}</span>
        </div>
        <div className="llm-vs">
          <span className="llm-vs-text">vs</span>
        </div>
        <div className="llm-team llm-away" style={{ borderColor: awayTeam.color }}>
          <span className="llm-team-score">{awayGoals}</span>
          <span className="llm-team-name">{awayTeam.shortName}</span>
        </div>
      </div>

      <div className="llm-feed" ref={feedRef}>
        {visibleCount === 0 && (
          <div className="llm-event llm-kickoff">
            <span className="llm-minute">0'</span>
            <span className="llm-desc">The match is underway! {homeTeam.shortName} kick off.</span>
          </div>
        )}
        {events.slice(0, visibleCount).map((e, i) => {
          const llm = llmEvents[i]
          const isGoal = e.type === 'goal'
          const isHalfTime = llm?.type === 'half_time'
          const isFullTime = llm?.type === 'full_time'
          const isCard = llm?.type === 'card'
          return (
            <div
              key={e.id}
              className={`llm-event ${isGoal ? 'llm-goal' : ''} ${isHalfTime ? 'llm-break' : ''} ${isFullTime ? 'llm-ft' : ''} ${isCard ? 'llm-card' : ''}`}
            >
              <span className="llm-minute">{e.minute}'</span>
              <span className="llm-desc">{e.description}</span>
              {isGoal && <span className="llm-goal-icon">⚽</span>}
            </div>
          )
        })}
        {isFinished && (
          <div className="llm-finished">
            <span className="llm-ft-text">Full Time</span>
            <div className="llm-ft-score">
              <span style={{ color: homeTeam.color }}>{homeTeam.shortName}</span>
              <span className="llm-ft-num">{homeGoals} - {awayGoals}</span>
              <span style={{ color: awayTeam.color }}>{awayTeam.shortName}</span>
            </div>
          </div>
        )}
      </div>

      <div className="llm-controls">
        {!isFinished && (
          <button className="ctrl-btn" onClick={() => setPlaying(!playing)}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        )}
        {!isFinished && (
          <div className="llm-speed">
            <button className={`ctrl-btn ${speed === 1 ? 'active' : ''}`} onClick={() => setSpeed(1)}>1x</button>
            <button className={`ctrl-btn ${speed === 2 ? 'active' : ''}`} onClick={() => setSpeed(2)}>2x</button>
            <button className={`ctrl-btn ${speed === 4 ? 'active' : ''}`} onClick={() => setSpeed(4)}>4x</button>
          </div>
        )}
        {!isFinished && (
          <button className="ctrl-btn" onClick={() => setVisibleCount(totalEvents)}>
            ⏩ Skip to End
          </button>
        )}
        {isFinished && (
          <button className="ctrl-btn" style={{ background: '#27ae60', borderColor: '#27ae60', color: '#fff' }} onClick={onFinish}>
            Finish Match & Back to League
          </button>
        )}
      </div>
    </div>
  )
}