import { Position, PlayerAttrs, FORMATIONS } from '../match/types'
import { FormationName } from './types'

/* ------------------------------------------------------------------ *
 * Fantasy manager pool for the online league draft. Each manager has  *
 * a preferred formation and a per-position playstyle system. Players  *
 * drafted into a slot gain a bonus when their playstyle matches the    *
 * manager's required playstyle for that slot, and the whole team gets  *
 * a chemistry bonus from nationality groups. All math is pure and      *
 * deterministic so both online clients compute identical scores.      *
 * ------------------------------------------------------------------ */

export interface FantasyManager {
  id: string
  name: string
  nationality: string
  formation: FormationName
  philosophy: string
  /** Required playstyle per position. Positions absent from the formation are unused. */
  system: Partial<Record<Position, string>>
}

const SYSTEM: Record<string, Partial<Record<Position, string>>> = {
  xabiAlonso: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CDM: 'Holding Midfielder', CAM: 'Chance Creator', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'False 9',
  },
  guardiola: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Inverted Fullback', RB: 'Inverted Fullback',
    CM: 'Deep-Lying Playmaker', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'False 9',
  },
  klopp: {
    GK: 'Sweeper Keeper', CB: 'Stopper', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CM: 'Box-to-Box Midfielder', LW: 'Explosive Winger', RW: 'Inside Forward', ST: 'Advanced Striker',
  },
  mourinho: {
    GK: 'Goalkeeper', CB: 'Defensive Defender', LB: 'Complete Defender', RB: 'Complete Defender',
    CDM: 'Holding Midfielder', CAM: 'Creative Playmaker', LW: 'Winger', RW: 'Winger', ST: 'Target Forward',
  },
  ancelotti: {
    GK: 'Goalkeeper', CB: 'Complete Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    LM: 'Winger', CM: 'Box-to-Box Midfielder', RM: 'Winger', ST: 'Complete Forward',
  },
  simeone: {
    GK: 'Goalkeeper', CB: 'Stopper', LM: 'Wingback', CM: 'Box-to-Box Midfielder', RM: 'Wingback',
    ST: 'Advanced Striker',
  },
  tuchel: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LM: 'Wingback', CM: 'Box-to-Box Midfielder',
    RM: 'Wingback', ST: 'Complete Forward',
  },
  nagelsmann: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CDM: 'Holding Midfielder', CAM: 'Creative Playmaker', LW: 'Inside Forward', RW: 'Inside Forward',
    ST: 'Advanced Striker',
  },
  zidane: {
    GK: 'Goalkeeper', CB: 'Ball-Playing Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CM: 'Creative Playmaker', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'Complete Forward',
  },
  pochettino: {
    GK: 'Sweeper Keeper', CB: 'Stopper', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CDM: 'Holding Midfielder', CAM: 'Chance Creator', LW: 'Explosive Winger', RW: 'Explosive Winger',
    ST: 'Advanced Striker',
  },
  conte: {
    GK: 'Goalkeeper', CB: 'Stopper', LM: 'Wingback', CM: 'Box-to-Box Midfielder', RM: 'Wingback',
    ST: 'Target Forward',
  },
  tenHag: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Inverted Fullback', RB: 'Attacking Fullback',
    CM: 'Deep-Lying Playmaker', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'Complete Forward',
  },
  slot: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Inverted Fullback', RB: 'Inverted Fullback',
    CM: 'Box-to-Box Midfielder', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'Advanced Striker',
  },
  deZerbi: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CM: 'Deep-Lying Playmaker', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'False 9',
  },
  flick: {
    GK: 'Goalkeeper', CB: 'Stopper', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CDM: 'Holding Midfielder', CAM: 'Chance Creator', LW: 'Explosive Winger', RW: 'Inside Forward',
    ST: 'Advanced Striker',
  },
  inzaghi: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LM: 'Wingback', CM: 'Deep-Lying Playmaker',
    RM: 'Wingback', ST: 'Complete Forward',
  },
  luisEnrique: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CM: 'Box-to-Box Midfielder', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'Complete Forward',
  },
  howe: {
    GK: 'Goalkeeper', CB: 'Stopper', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    CM: 'Box-to-Box Midfielder', LW: 'Explosive Winger', RW: 'Winger', ST: 'Advanced Striker',
  },
  arteta: {
    GK: 'Sweeper Keeper', CB: 'Ball-Playing Defender', LB: 'Inverted Fullback', RB: 'Inverted Fullback',
    CM: 'Deep-Lying Playmaker', LW: 'Inside Forward', RW: 'Inside Forward', ST: 'Complete Forward',
  },
  emery: {
    GK: 'Goalkeeper', CB: 'Defensive Defender', LB: 'Attacking Fullback', RB: 'Attacking Fullback',
    LM: 'Winger', CM: 'Box-to-Box Midfielder', RM: 'Winger', ST: 'Advanced Striker',
  },
}

export const FANTASY_MANAGERS: FantasyManager[] = [
  { id: 'xabiAlonso', name: 'Xabi Alonso', nationality: 'Spain', formation: '4-2-3-1', philosophy: 'Ball progression, technical midfield, attacking wing-backs', system: SYSTEM.xabiAlonso },
  { id: 'guardiola', name: 'Pep Guardiola', nationality: 'Spain', formation: '4-3-3', philosophy: 'Tiki-Taka: control the ball, control the game', system: SYSTEM.guardiola },
  { id: 'klopp', name: 'Jürgen Klopp', nationality: 'Germany', formation: '4-3-3', philosophy: 'Gegenpress: intensity, speed, verticality', system: SYSTEM.klopp },
  { id: 'mourinho', name: 'José Mourinho', nationality: 'Portugal', formation: '4-2-3-1', philosophy: 'Compact defence, lethal transitions', system: SYSTEM.mourinho },
  { id: 'ancelotti', name: 'Carlo Ancelotti', nationality: 'Italy', formation: '4-4-2', philosophy: 'Balance, class, adaptability', system: SYSTEM.ancelotti },
  { id: 'simeone', name: 'Diego Simeone', nationality: 'Argentina', formation: '3-5-2', philosophy: 'Cholismo: grit, compactness, counters', system: SYSTEM.simeone },
  { id: 'tuchel', name: 'Thomas Tuchel', nationality: 'Germany', formation: '3-5-2', philosophy: 'Structured possession, verticality', system: SYSTEM.tuchel },
  { id: 'nagelsmann', name: 'Julian Nagelsmann', nationality: 'Germany', formation: '4-2-3-1', philosophy: 'Adaptive, aggressive pressing', system: SYSTEM.nagelsmann },
  { id: 'zidane', name: 'Zinedine Zidane', nationality: 'France', formation: '4-3-3', philosophy: 'Flair, freedom, directness', system: SYSTEM.zidane },
  { id: 'pochettino', name: 'Mauricio Pochettino', nationality: 'Argentina', formation: '4-2-3-1', philosophy: 'High-intensity pressing', system: SYSTEM.pochettino },
  { id: 'conte', name: 'Antonio Conte', nationality: 'Italy', formation: '3-5-2', philosophy: 'Wing overload, set-piece power', system: SYSTEM.conte },
  { id: 'tenHag', name: 'Erik ten Hag', nationality: 'Netherlands', formation: '4-3-3', philosophy: 'Positional play, attacking full-backs', system: SYSTEM.tenHag },
  { id: 'slot', name: 'Arne Slot', nationality: 'Netherlands', formation: '4-3-3', philosophy: 'Gegenpress, positional rotations', system: SYSTEM.slot },
  { id: 'deZerbi', name: 'Roberto De Zerbi', nationality: 'Italy', formation: '4-3-3', philosophy: 'Total football: risk, rotations', system: SYSTEM.deZerbi },
  { id: 'flick', name: 'Hansi Flick', nationality: 'Germany', formation: '4-2-3-1', philosophy: 'Ultra high press, early goals', system: SYSTEM.flick },
  { id: 'inzaghi', name: 'Simone Inzaghi', nationality: 'Italy', formation: '3-5-2', philosophy: 'Wing-back overload, possession', system: SYSTEM.inzaghi },
  { id: 'luisEnrique', name: 'Luis Enrique', nationality: 'Spain', formation: '4-3-3', philosophy: 'Press and possession: total football', system: SYSTEM.luisEnrique },
  { id: 'howe', name: 'Eddie Howe', nationality: 'England', formation: '4-3-3', philosophy: 'Gegenpress, explosive wing play', system: SYSTEM.howe },
  { id: 'arteta', name: 'Mikel Arteta', nationality: 'Spain', formation: '4-3-3', philosophy: 'Positional play, inverted full-backs', system: SYSTEM.arteta },
  { id: 'emery', name: 'Unai Emery', nationality: 'Spain', formation: '4-4-2', philosophy: 'Organised counter attack', system: SYSTEM.emery },
]

export function getFantasyManager(id: string | null | undefined): FantasyManager | null {
  if (!id) return null
  return FANTASY_MANAGERS.find(m => m.id === id) ?? null
}

/* Formation slot positions, derived from the engine's FORMATIONS so the
   draft slots always match what the match engine/pitch renders. */
export function managerFormationPositions(manager: FantasyManager): Position[] {
  return FORMATIONS[manager.formation].map(f => f.position as Position)
}

/* ------------------------------------------------------------------ *
 * Chemistry — nationality groups. A group with 3+ players is          *
 * "completed" and contributes points; the manager's own nationality   *
 * adds a link bonus when that group is completed. Capped at 100.     *
 * ------------------------------------------------------------------ */

export function computeChemistry(
  picks: { position: Position; nationality?: string | null }[],
  manager: FantasyManager
): number {
  const counts = new Map<string, number>()
  for (const p of picks) {
    const nat = p.nationality?.trim()
    if (!nat) continue
    counts.set(nat, (counts.get(nat) ?? 0) + 1)
  }

  let total = 0
  for (const count of counts.values()) {
    if (count >= 3) total += Math.min(count, 6) * 5
  }
  if ((counts.get(manager.nationality) ?? 0) >= 3) total += 10
  return Math.min(100, total)
}

/* ------------------------------------------------------------------ *
 * System proficiency — fraction of drafted players whose playstyle    *
 * matches the manager's requirement for their slot, as a 0-100 score. *
 * ------------------------------------------------------------------ */

export function computeSystemProficiency(
  picks: { position: Position; playstyle?: string | null }[],
  manager: FantasyManager
): number {
  const slots = managerFormationPositions(manager)
  let matched = 0
  // Picks are stored in formation-slot order (pick_round = slot index), so
  // match index-to-index. This correctly handles repeated positions (two
  // CDMs, three CMs, etc.) instead of `find` returning the same player twice.
  for (let i = 0; i < slots.length; i++) {
    const required = manager.system[slots[i]]
    if (!required) continue
    const player = picks[i]
    if (player && player.playstyle === required) matched++
  }
  return Math.round((matched / slots.length) * 100)
}

/* ------------------------------------------------------------------ *
 * Squad ratings — average rating (overall) per unit.                  *
 * ------------------------------------------------------------------ */

export interface SquadRatings {
  attack: number
  midfield: number
  defence: number
  goalkeeper: number
  overall: number
}

export function computeSquadRatings(
  picks: { position: Position; rating?: number | null; attrs?: Partial<PlayerAttrs> }[]
): SquadRatings {
  const groups: Record<'attack' | 'midfield' | 'defence' | 'goalkeeper', number[]> = {
    attack: [], midfield: [], defence: [], goalkeeper: [],
  }

  const overallOf = (p: { position: Position; rating?: number | null; attrs?: Partial<PlayerAttrs> }): number => {
    if (p.rating) return p.rating
    const a = p.attrs
    if (a) {
      return Math.round(((a.pace ?? 50) + (a.shooting ?? 50) + (a.passing ?? 50) + (a.dribbling ?? 50) + (a.defending ?? 50) + (a.physical ?? 50)) / 6)
    }
    return 0
  }

  for (const p of picks) {
    const pos = p.position
    if (pos === 'GK') groups.goalkeeper.push(overallOf(p))
    else if (pos === 'CB' || pos === 'LB' || pos === 'RB') groups.defence.push(overallOf(p))
    else if (pos === 'CDM' || pos === 'CM' || pos === 'CAM' || pos === 'LM' || pos === 'RM') groups.midfield.push(overallOf(p))
    else groups.attack.push(overallOf(p))
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
  const attack = avg(groups.attack)
  const midfield = avg(groups.midfield)
  const defence = avg(groups.defence)
  const goalkeeper = avg(groups.goalkeeper)
  const all = [...groups.attack, ...groups.midfield, ...groups.defence, ...groups.goalkeeper]
  return { attack, midfield, defence, goalkeeper, overall: avg(all) }
}

/* ------------------------------------------------------------------ *
 * Match bonus — deterministic attribute boost applied to a player.    *
 *  - system proficiency: player's playstyle matches the slot → +2 all
 *  - chemistry: team-wide +round(chemistry/100 * 4) to all attrs
 * ------------------------------------------------------------------ */

export function applyFantasyBonus(
  manager: FantasyManager,
  chemistry: number,
  systemProficiency: number,
  player: { position: Position; playstyle?: string | null },
  attrs: PlayerAttrs
): PlayerAttrs {
  const chemistryBoost = Math.round((chemistry / 100) * 4)
  const systemMatch = manager.system[player.position] && manager.system[player.position] === player.playstyle
  const systemBoost = systemMatch ? 2 : 0
  const boost = chemistryBoost + systemBoost

  const out: PlayerAttrs = { ...attrs }
  ;(Object.keys(out) as (keyof PlayerAttrs)[]).forEach(k => {
    out[k] = Math.min(99, Math.max(40, out[k] + boost))
  })
  return out
}
