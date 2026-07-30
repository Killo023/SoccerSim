import { create } from 'zustand'
import { League, Cup } from '../league/types'
import { createLeague } from '../league/engine/LeagueEngine'
import { generateCup } from '../league/engine/CupEngine'
import { LEAGUES, LeagueDefinition, getLeague } from '../league/data/clubs'

type View = 'menu' | 'league' | 'cup' | 'match' | 'multiplayer'

interface LeagueStore {
  leagues: LeagueDefinition[]
  selectedLeagueId: string
  league: League
  cup: Cup
  view: View
  selectedWeek: number
  setView: (view: View) => void
  setSelectedWeek: (week: number) => void
  setLeague: (league: League) => void
  setCup: (cup: Cup) => void
  selectLeague: (id: string) => void
  resetSeason: () => void
}

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  leagues: LEAGUES,
  selectedLeagueId: 'premier-league',
  league: createLeague(getLeague('premier-league')?.clubs),
  cup: generateCup(getLeague('premier-league')?.clubs),
  view: 'menu',
  selectedWeek: 1,
  setView: (view) => set({ view }),
  setSelectedWeek: (week) => set({ selectedWeek: week }),
  setLeague: (league) => set({ league }),
  setCup: (cup) => set({ cup }),
  selectLeague: (id) => {
    const def = getLeague(id)
    if (def) {
      set({
        selectedLeagueId: id,
        league: createLeague(def.clubs),
        cup: generateCup(def.clubs),
        selectedWeek: 1,
      })
    }
  },
  resetSeason: () => {
    const { selectedLeagueId } = get()
    const def = getLeague(selectedLeagueId)
    if (def) {
      set({
        league: createLeague(def.clubs),
        cup: generateCup(def.clubs),
        selectedWeek: 1,
      })
    }
  },
}))
