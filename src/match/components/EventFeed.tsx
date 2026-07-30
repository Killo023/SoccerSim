import { useEffect, useRef } from 'react'
import { useMatchStore } from '../../store/matchStore'

export function EventFeed() {
  const matchState = useMatchStore(s => s.matchState)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [matchState?.events.length])

  if (!matchState) return null

  const events = [...matchState.events].reverse()

  return (
    <div className="event-feed" ref={scrollRef}>
      <h3>Match Feed</h3>
      {events.length === 0 && (
        <div className="event-empty">Waiting for action...</div>
      )}
      {events.map((evt) => (
        <div
          key={evt.id}
          className={`event-item ${evt.type} ${evt.team}`}
        >
          <span className="event-minute">{evt.minute}'</span>
          <span className="event-desc">{evt.description}</span>
        </div>
      ))}
    </div>
  )
}
