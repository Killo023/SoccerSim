import { create } from 'zustand'
import { PlayerProfile, CustomTeam, CustomPlayerDef, MultiplayerPhase, FormationName, TEAM_CREATION_SECONDS, DraftSlot } from './types'
import { Club, League } from '../league/types'
import { LEAGUES } from '../league/data/clubs'
import { createLeague, getWeekFixtures, setFixtureResult, advanceWeek, getClubById, computeStandings } from '../league/engine/LeagueEngine'
import { clubToTeamData } from '../match/engine/TeamConverter'
import { fastSimulate } from '../match/engine/FastSimulator'
import { FORMATIONS } from '../match/types'

export function customTeamToClub(team: CustomTeam): Club {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    players: team.players.map(p => ({
      name: p.name,
      number: p.number,
      position: p.position,
      attrs: { ...p.attrs },
    })),
    formation: [...team.formation],
  }
}

export function draftSlotsToCustomTeam(
  ownerId: string,
  ownerName: string,
  teamName: string,
  shortName: string,
  color: string,
  formation: FormationName,
  slots: DraftSlot[]
): CustomTeam {
  const formPositions = FORMATIONS[formation].map(f => f.position)
  const players: CustomPlayerDef[] = slots.map((slot, i) => {
    const p = slot.player!
    return {
      name: p.name,
      number: i + 1,
      position: slot.position,
      attrs: { ...p.attrs },
    }
  })
  return {
    id: `custom-${ownerId}`,
    name: teamName,
    shortName,
    color,
    players,
    formation: formPositions,
    ownerId,
    ownerName,
    locked: true,
  }
}

interface MultiplayerStore {
  players: PlayerProfile[]
  phase: MultiplayerPhase
  currentCreatorIndex: number
  countdown: number
  selectedBaseLeagueId: string
  replaceCount: number
  customTeams: CustomTeam[]
  league: League | null
  watchingMatch: { homeId: string; awayId: string } | null
  simming: boolean
  fastForwarding: boolean

  addPlayer: (name: string, color: string) => void
  removePlayer: (id: string) => void
  setPhase: (phase: MultiplayerPhase) => void
  setCurrentCreatorIndex: (idx: number) => void
  setCountdown: (n: number) => void
  tickCountdown: () => void
  setSelectedBaseLeagueId: (id: string) => void
  setReplaceCount: (n: number) => void
  registerTeam: (team: CustomTeam) => void
  setCustomTeams: (teams: CustomTeam[]) => void
  setLeague: (league: League | null) => void
  setWatchingMatch: (val: { homeId: string; awayId: string } | null) => void
  setSimming: (val: boolean) => void
  setFastForwarding: (val: boolean) => void

  startLeague: () => void
  simWeek: () => void
  advanceWeek: () => void
  fastForwardAll: () => void
  getCurrentCreator: () => PlayerProfile | undefined
  getPlayerTeamIds: () => string[]
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  players: [],
  phase: 'setup',
  currentCreatorIndex: 0,
  countdown: TEAM_CREATION_SECONDS,
  selectedBaseLeagueId: 'premier-league',
  replaceCount: 2,
  customTeams: [],
  league: null,
  watchingMatch: null,
  simming: false,
  fastForwarding: false,

  addPlayer: (name, color) => set(s => ({
    players: [...s.players, { id: `player-${Date.now()}`, name, color, team: null }],
  })),
  removePlayer: (id) => set(s => ({
    players: s.players.filter(p => p.id !== id),
  })),
  setPhase: (phase) => set({ phase }),
  setCurrentCreatorIndex: (idx) => set({ currentCreatorIndex: idx }),
  setCountdown: (n) => set({ countdown: n }),
  tickCountdown: () => {
    const s = get()
    if (s.countdown > 0) {
      set({ countdown: s.countdown - 1 })
    }
  },
  setSelectedBaseLeagueId: (id) => set({ selectedBaseLeagueId: id }),
  setReplaceCount: (n) => set({ replaceCount: n }),
  registerTeam: (team) => set(s => ({
    customTeams: [...s.customTeams.filter(t => t.ownerId !== team.ownerId), team],
    players: s.players.map(p => p.id === team.ownerId ? { ...p, team } : p),
  })),
  setCustomTeams: (teams) => set({ customTeams: teams }),
  setLeague: (league) => set({ league }),
  setWatchingMatch: (val) => set({ watchingMatch: val }),
  setSimming: (val) => set({ simming: val }),
  setFastForwarding: (val) => set({ fastForwarding: val }),

  getCurrentCreator: () => {
    const s = get()
    return s.players[s.currentCreatorIndex]
  },

  getPlayerTeamIds: () => {
    return get().customTeams.map(t => t.id)
  },

  startLeague: () => {
    const s = get()
    const def = LEAGUES.find(l => l.id === s.selectedBaseLeagueId)
    if (!def) return

    const baseClubs = [...def.clubs]
    const toReplace = Math.min(s.replaceCount, baseClubs.length, s.customTeams.length)

    const playerClubs = s.customTeams.slice(0, toReplace).map(customTeamToClub)

    for (let i = 0; i < toReplace; i++) {
      baseClubs[i] = playerClubs[i]
    }

    const league = createLeague(baseClubs)
    league.name = `${def.name} (Multiplayer)`
    set({ league, phase: 'league', watchingMatch: null })
  },

  simWeek: () => {
    const s = get()
    if (!s.league) return
    const league = { ...s.league }
    const weekFixtures = getWeekFixtures(league, league.currentWeek)
    const unplayed = weekFixtures.filter(f => !f.played)
    const playerTeamIds = s.customTeams.map(t => t.id)

    for (const fixture of unplayed) {
      const homeClub = getClubById(league, fixture.homeClubId)
      const awayClub = getClubById(league, fixture.awayClubId)
      if (!homeClub || !awayClub) continue

      const isPlayerMatch = playerTeamIds.includes(fixture.homeClubId) && playerTeamIds.includes(fixture.awayClubId)

      if (isPlayerMatch) {
        set({ watchingMatch: { homeId: fixture.homeClubId, awayId: fixture.awayClubId }, simming: false, fastForwarding: false })
        return
      }

      const homeTeam = clubToTeamData(homeClub, 'home')
      const awayTeam = clubToTeamData(awayClub, 'away')
      const result = fastSimulate(homeTeam, awayTeam)
      setFixtureResult(league, fixture.id, result)
    }

    set({ league })
  },

  advanceWeek: () => {
    const s = get()
    if (!s.league) return
    const league = { ...s.league }
    advanceWeek(league)
    set({ league })
  },

  fastForwardAll: () => {
    const s = get()
    if (!s.league) return
    set({ fastForwarding: true })

    const doSim = () => {
      const state = get()
      if (!state.league || !state.fastForwarding) return

      if (state.league.seasonComplete) {
        set({ fastForwarding: false })
        return
      }

      const league = { ...state.league }
      const weekFixtures = getWeekFixtures(league, league.currentWeek)
      const unplayed = weekFixtures.filter(f => !f.played)
      const playerTeamIds = state.customTeams.map(t => t.id)

      if (unplayed.length === 0) {
        advanceWeek(league)
        if (league.seasonComplete) {
          set({ league, fastForwarding: false })
          return
        }
        set({ league })
        setTimeout(doSim, 200)
        return
      }

      const hasPlayerMatch = unplayed.some(f =>
        playerTeamIds.includes(f.homeClubId) && playerTeamIds.includes(f.awayClubId)
      )

      if (hasPlayerMatch) {
        const matchFixture = unplayed.find(f =>
          playerTeamIds.includes(f.homeClubId) && playerTeamIds.includes(f.awayClubId)
        )
        if (matchFixture) {
          set({
            watchingMatch: { homeId: matchFixture.homeClubId, awayId: matchFixture.awayClubId },
            fastForwarding: false,
          })
        }
        return
      }

      for (const fixture of unplayed) {
        const homeClub = getClubById(league, fixture.homeClubId)
        const awayClub = getClubById(league, fixture.awayClubId)
        if (!homeClub || !awayClub) continue
        const homeTeam = clubToTeamData(homeClub, 'home')
        const awayTeam = clubToTeamData(awayClub, 'away')
        const result = fastSimulate(homeTeam, awayTeam)
        setFixtureResult(league, fixture.id, result)
      }

      const nextWeek = league.currentWeek + 1
      const hasNextFixtures = league.fixtures.some(f => f.week === nextWeek)
      if (!hasNextFixtures) {
        league.seasonComplete = true
        set({ league, fastForwarding: false })
        return
      }
      league.currentWeek = nextWeek
      set({ league })
      setTimeout(doSim, 200)
    }

    doSim()
  },
}))