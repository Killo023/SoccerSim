import { TeamData, MatchEvent, MatchStats } from '../types'
import { v4 as uuid } from 'uuid'

export interface LLMEvent {
  minute: number
  type: 'goal' | 'shot' | 'save' | 'card' | 'foul' | 'corner' | 'half_time' | 'full_time'
  team: 'home' | 'away'
  player: string
  description: string
}

const API_URL = 'https://mlvoca.com/api/generate'

function buildPrompt(homeTeam: TeamData, awayTeam: TeamData): string {
  const fmtPlayers = (t: TeamData) =>
    t.players.map(p =>
      `${p.name} (#${p.number}) — ${p.position} — ` +
      `PAC:${p.attrs.pace} SHO:${p.attrs.shooting} PAS:${p.attrs.passing} ` +
      `DRI:${p.attrs.dribbling} DEF:${p.attrs.defending} PHY:${p.attrs.physical}`
    ).join('\n')

  return `You are a football match commentator. Generate a realistic simulated match between these two teams.

HOME TEAM: ${homeTeam.name}
Formation: ${homeTeam.formation.join('-')}
Players:
${fmtPlayers(homeTeam)}

AWAY TEAM: ${awayTeam.name}
Formation: ${awayTeam.formation.join('-')}
Players:
${fmtPlayers(awayTeam)}

Generate 6-15 match events in this EXACT JSON format (only return the JSON array — no markdown, no explanation, no backticks):
[
  {"minute": 12, "type": "goal", "team": "home", "player": "B. Saka", "description": "GOAL! B. Saka curls a beautiful shot into the top corner from 18 yards!"},
  {"minute": 28, "type": "shot", "team": "away", "player": "K. Mbappe", "description": "K. Mbappe cuts inside and fires just wide of the far post."},
  {"minute": 45, "type": "half_time", "team": "home", "player": "", "description": "Half time! The score is 1-0."}
]

Rules:
- Event types allowed: goal, shot, save, card, foul, corner, half_time, full_time
- Spread events across both halves (minutes 1-45 and 46-90)
- Include half_time and full_time events
- 1-4 total goals realistic for a football match
- Higher rated players SHOULD have more impact (goals, key plays)
- Each event needs a vivid, realistic description
- Order events by minute (ascending)
- Team must be "home" or "away"`
}

function parseLLMResponse(text: string): LLMEvent[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON array found in response')

  const json = cleaned.slice(start, end + 1)
  const parsed: LLMEvent[] = JSON.parse(json)

  if (!Array.isArray(parsed) || parsed.length < 2) throw new Error('Invalid events array')

  for (const e of parsed) {
    if (typeof e.minute !== 'number' || typeof e.type !== 'string' || typeof e.description !== 'string') {
      throw new Error('Invalid event structure')
    }
  }

  return parsed.sort((a, b) => a.minute - b.minute)
}

function eventsToMatchEvents(llmEvents: LLMEvent[]): MatchEvent[] {
  return llmEvents.map(e => ({
    id: uuid(),
    type: e.type === 'goal' ? 'goal' :
          e.type === 'shot' ? 'shot' :
          e.type === 'save' ? 'save' :
          e.type === 'card' ? 'foul' :
          e.type === 'foul' ? 'foul' :
          e.type === 'corner' ? 'corner' :
          e.type === 'half_time' ? 'half_time' :
          'full_time',
    minute: e.minute,
    team: e.team,
    playerId: e.player || undefined,
    x: 0,
    y: 0,
    description: e.description,
  }))
}

export function computeLLMResult(llmEvents: LLMEvent[]): { homeGoals: number; awayGoals: number } {
  let homeGoals = 0
  let awayGoals = 0
  for (const e of llmEvents) {
    if (e.type === 'goal') {
      if (e.team === 'home') homeGoals++
      else awayGoals++
    }
  }
  return { homeGoals, awayGoals }
}

export async function generateLLMMatch(
  homeTeam: TeamData,
  awayTeam: TeamData
): Promise<{ events: MatchEvent[]; llmEvents: LLMEvent[]; homeGoals: number; awayGoals: number }> {
  const prompt = buildPrompt(homeTeam, awayTeam)

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tinyllama',
      prompt,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const text: string = data.response ?? data.message ?? JSON.stringify(data)

  const llmEvents = parseLLMResponse(text)
  const matchEvents = eventsToMatchEvents(llmEvents)
  const { homeGoals, awayGoals } = computeLLMResult(llmEvents)

  return { events: matchEvents, llmEvents, homeGoals, awayGoals }
}