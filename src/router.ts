import { useState, useEffect } from 'react'

export interface RouteInfo {
  page: string
  params: Record<string, string>
}

function parseHash(): RouteInfo {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const parts = hash.split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'menu', params: {} }
  if (parts[0] === 'login') return { page: 'login', params: {} }
  if (parts[0] === 'signup') return { page: 'signup', params: {} }
  if (parts[0] === 'create-league') return { page: 'create-league', params: {} }
  if (parts[0] === 'join' && parts[1]) return { page: 'join', params: { code: parts[1] } }
  if (parts[0] === 'league' && parts[1]) return { page: 'league', params: { id: parts[1] } }
  if (parts[0] === 'draft' && parts[1]) return { page: 'draft', params: { id: parts[1] } }
  if (parts[0] === 'online-league' && parts[1]) return { page: 'online-league', params: { id: parts[1] } }
  return { page: 'menu', params: {} }
}

export function useHashRoute() {
  const [route, setRoute] = useState<RouteInfo>(parseHash)

  useEffect(() => {
    function onHashChange() { setRoute(parseHash()) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}
