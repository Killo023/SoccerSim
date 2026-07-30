import { useEffect, useState } from 'react'
import type { League, LeagueMember } from '../../supabase/types'
import { getLeague, getLeagueMembers, getUserLeagues } from '../api/leagues'

export function useUserLeagues(profileId: string | undefined) {
  const [leagues, setLeagues] = useState<(League & { member: LeagueMember })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) { setLoading(false); return }
    getUserLeagues(profileId).then(data => { setLeagues(data); setLoading(false) })
  }, [profileId])

  return { leagues, loading }
}

export function useLeague(leagueId: string | undefined) {
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) { setLoading(false); return }
    Promise.all([getLeague(leagueId), getLeagueMembers(leagueId)]).then(([l, m]) => {
      setLeague(l)
      setMembers(m as LeagueMember[])
      setLoading(false)
    })
  }, [leagueId])

  return { league, members, loading, refresh: () => {
    if (!leagueId) return
    getLeagueMembers(leagueId).then(data => setMembers(data as LeagueMember[]))
  }}
}
