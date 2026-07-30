import { create } from 'zustand'
import { MatchState } from '../match/types'

interface MatchStore {
  matchState: MatchState | null
  engineRef: { current: any } | null
  isJumpedIn: boolean
  setMatchState: (state: MatchState) => void
  setEngineRef: (ref: { current: any }) => void
  setJumpedIn: (val: boolean) => void
}

export const useMatchStore = create<MatchStore>((set) => ({
  matchState: null,
  engineRef: null,
  isJumpedIn: false,
  setMatchState: (state) => set({ matchState: state }),
  setEngineRef: (ref) => set({ engineRef: ref }),
  setJumpedIn: (val) => set({ isJumpedIn: val }),
}))
