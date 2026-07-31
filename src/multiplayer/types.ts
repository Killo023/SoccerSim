import { PlayerAttrs, Position } from '../match/types'
import { DraftPlayer } from './playerPool'

export interface CustomPlayerDef {
  name: string
  number: number
  position: Position
  attrs: PlayerAttrs
}

export interface DraftSlot {
  position: Position
  filled: boolean
  player: DraftPlayer | null
}

export interface CustomTeam {
  id: string
  name: string
  shortName: string
  color: string
  players: CustomPlayerDef[]
  formation: Position[]
  ownerId: string
  ownerName: string
  locked: boolean
}

export interface PlayerProfile {
  id: string
  name: string
  color: string
  team: CustomTeam | null
}

export type MultiplayerPhase = 'setup' | 'creating' | 'lobby' | 'league' | 'match'

export const FORMATION_OPTIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '4-3-2-1'] as const
export type FormationName = typeof FORMATION_OPTIONS[number]

export const TEAM_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#2980b9',
  '#27ae60', '#f1c40f', '#8e44ad', '#16a085', '#d35400',
  '#2c3e50', '#e91e63', '#00bcd4', '#ff5722', '#607d8b',
]

export const DRAFT_OPTIONS_PER_PICK = 3
export const MAX_ROLLS_PER_PICK = 10
export const TEAM_CREATION_SECONDS = 120