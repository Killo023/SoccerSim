import { ManagerProfile, TacticalSystem } from '../types'
import { PlayerAttrs } from '../../match/types'
import { seedFromString } from '../../match/rng'

/* ------------------------------------------------------------------ *
 * Real 2026-27 managers with their preferred tactical system and      *
 * proficiency ratings (0-100) per system. Ratings beyond the ones the *
 * user specified are filled with sensible secondary proficiencies.    *
 * ------------------------------------------------------------------ */

export const REAL_MANAGERS: Record<string, ManagerProfile> = {
  Arsenal: {
    name: 'Mikel Arteta',
    preferredSystem: 'Positional Play',
    systemRatings: { 'Positional Play': 100, 'Tiki-Taka': 96, 'Total Football': 91 },
  },
  'Manchester City': {
    name: 'Pep Guardiola',
    preferredSystem: 'Tiki-Taka',
    systemRatings: { 'Tiki-Taka': 100, 'Positional Play': 98, 'Total Football': 94 },
  },
  'Manchester United': {
    name: 'Rúben Amorim',
    preferredSystem: 'Gegenpress',
    systemRatings: { Gegenpress: 100, 'Positional Play': 88, 'Compact Defence': 85 },
  },
  Liverpool: {
    name: 'Arne Slot',
    preferredSystem: 'Gegenpress',
    systemRatings: { Gegenpress: 100, 'Positional Play': 92, 'Direct Play': 85 },
  },
  'Aston Villa': {
    name: 'Unai Emery',
    preferredSystem: 'Counter Attack',
    systemRatings: { 'Counter Attack': 100, 'Compact Defence': 90, 'Wing Overload': 84 },
  },
  Chelsea: {
    name: 'Enzo Maresca',
    preferredSystem: 'Positional Play',
    systemRatings: { 'Positional Play': 100, 'Tiki-Taka': 90, 'Direct Play': 83 },
  },
  'Tottenham Hotspur': {
    name: 'Thomas Frank',
    preferredSystem: 'Direct Play',
    systemRatings: { 'Direct Play': 100, Gegenpress: 84, 'Counter Attack': 82 },
  },
  'Newcastle United': {
    name: 'Eddie Howe',
    preferredSystem: 'Gegenpress',
    systemRatings: { Gegenpress: 100, 'Compact Defence': 86, 'Wing Overload': 83 },
  },
  Fulham: {
    name: 'Marco Silva',
    preferredSystem: 'Wing Overload',
    systemRatings: { 'Wing Overload': 100, 'Positional Play': 86, 'Direct Play': 82 },
  },
  'Crystal Palace': {
    name: 'Oliver Glasner',
    preferredSystem: 'Counter Attack',
    systemRatings: { 'Counter Attack': 100, 'Compact Defence': 88, 'Direct Play': 83 },
  },
  'Nottingham Forest': {
    name: 'Nuno Espírito Santo',
    preferredSystem: 'Compact Defence',
    systemRatings: { 'Compact Defence': 100, 'Counter Attack': 88, 'Direct Play': 85 },
  },
  Everton: {
    name: 'David Moyes',
    preferredSystem: 'Compact Defence',
    systemRatings: { 'Compact Defence': 100, 'Counter Attack': 85, 'Direct Play': 84 },
  },
  'Leeds United': {
    name: 'Daniel Farke',
    preferredSystem: 'Direct Play',
    systemRatings: { 'Direct Play': 100, 'Positional Play': 84, Gegenpress: 80 },
  },
  Bournemouth: {
    name: 'Andoni Iraola',
    preferredSystem: 'Gegenpress',
    systemRatings: { Gegenpress: 100, 'Counter Attack': 82, 'Compact Defence': 80 },
  },
  'Brighton & Hove Albion': {
    name: 'Fabian Hürzeler',
    preferredSystem: 'Total Football',
    systemRatings: { 'Total Football': 100, 'Tiki-Taka': 90, 'Positional Play': 88 },
  },
  Brentford: {
    name: 'Keith Andrews',
    preferredSystem: 'Direct Play',
    systemRatings: { 'Direct Play': 100, Gegenpress: 83, 'Compact Defence': 81 },
  },
  Sunderland: {
    name: 'Régis Le Bris',
    preferredSystem: 'Counter Attack',
    systemRatings: { 'Counter Attack': 100, 'Direct Play': 84, 'Compact Defence': 82 },
  },
  'Coventry City': {
    name: 'Frank Lampard',
    preferredSystem: 'Wing Overload',
    systemRatings: { 'Wing Overload': 100, 'Direct Play': 82, 'Positional Play': 80 },
  },
  'Hull City': {
    name: 'Sergej Jakirović',
    preferredSystem: 'Direct Play',
    systemRatings: { 'Direct Play': 100, 'Counter Attack': 82, 'Compact Defence': 80 },
  },
  'Ipswich Town': {
    name: 'Kieran McKenna',
    preferredSystem: 'Positional Play',
    systemRatings: { 'Positional Play': 100, 'Tiki-Taka': 90, 'Direct Play': 82 },
  },
}

/* ------------------------------------------------------------------ *
 * Generated default managers. Deterministic from the club name so     *
 * both online-league clients build identical managers (and thus       *
 * identical tactical bonuses), preserving match determinism.          *
 * ------------------------------------------------------------------ */

const TACTICAL_SYSTEMS: TacticalSystem[] = [
  'Gegenpress',
  'Positional Play',
  'Tiki-Taka',
  'Counter Attack',
  'Direct Play',
  'Wing Overload',
  'Compact Defence',
  'Total Football',
]

const MANAGER_SURNAMES = [
  'Vidal', 'Fontaine', 'Kovač', 'Marchetti', 'Silva', 'Bennett', 'Ivanov',
  'Costa', 'Herrera', 'Bianchi', 'Okafor', 'Nilsen', 'Keller', 'Rossi',
  'Møller', 'Djuric', 'Petrov', 'Andersson', 'Leroy', 'Moreau', 'Koch',
  'Varga', 'Nowak', 'Lindqvist', 'Santos', 'Ramos', 'Fischer', 'Novak',
  'Weber', 'Duarte', 'Pinto', 'Hansen', 'Eriksen', 'Jovanović', 'Meyer',
]

const FIRST_INITIALS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function generateDefaultManager(clubName: string): ManagerProfile {
  const h = seedFromString(clubName)
  const surname = MANAGER_SURNAMES[h % MANAGER_SURNAMES.length]
  const initial = FIRST_INITIALS[Math.floor(h / 7) % FIRST_INITIALS.length]
  const preferred = TACTICAL_SYSTEMS[h % TACTICAL_SYSTEMS.length]

  const systemRatings: Partial<Record<TacticalSystem, number>> = {}
  for (let i = 0; i < TACTICAL_SYSTEMS.length; i++) {
    const sys = TACTICAL_SYSTEMS[i]
    const base = 55 + ((h >> 3) + i * 9) % 30 // 55-84
    systemRatings[sys] = Math.min(100, base)
  }
  systemRatings[preferred] = Math.min(100, 85 + (h >> 5) % 15) // 85-99 in preferred system

  return { name: `${initial}. ${surname}`, preferredSystem: preferred, systemRatings }
}

/** Returns the real manager when the club is one of the 20 known, else a deterministic default. */
export function getTeamManager(clubName: string): ManagerProfile {
  return REAL_MANAGERS[clubName] ?? generateDefaultManager(clubName)
}

/* ------------------------------------------------------------------ *
 * Tactical bonus. A manager's preferred system boosts the attributes  *
 * most relevant to that system, scaled by their proficiency in it.    *
 * Applied deterministically so online match simulations stay in sync. *
 * ------------------------------------------------------------------ */

const SYSTEM_ATTR_FOCUS: Record<TacticalSystem, Partial<PlayerAttrs>> = {
  Gegenpress: { pace: 3, physical: 2, defending: 1 },
  'Positional Play': { passing: 3, dribbling: 2, physical: 1 },
  'Tiki-Taka': { passing: 4, dribbling: 3 },
  'Counter Attack': { pace: 3, shooting: 2, passing: 1 },
  'Direct Play': { passing: 2, shooting: 3, physical: 2 },
  'Wing Overload': { pace: 2, dribbling: 3, passing: 2 },
  'Compact Defence': { defending: 4, physical: 2, pace: 1 },
  'Total Football': { pace: 2, passing: 2, dribbling: 2, defending: 1, shooting: 1 },
}

export function applyManagerBonus(manager: ManagerProfile, attrs: PlayerAttrs): PlayerAttrs {
  const proficiency = manager.systemRatings[manager.preferredSystem] ?? 85
  const focus = SYSTEM_ATTR_FOCUS[manager.preferredSystem]
  const scale = proficiency / 100
  const out: PlayerAttrs = { ...attrs }
  ;(Object.keys(focus) as (keyof PlayerAttrs)[]).forEach(k => {
    out[k] = Math.min(99, out[k] + Math.round((focus[k] ?? 0) * scale))
  })
  return out
}
