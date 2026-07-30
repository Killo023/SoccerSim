import { Component, type ReactNode } from 'react'
import { isSupabaseConfigured } from './supabase/client'
import { AuthProvider } from './auth/context/AuthProvider'
import { useAuth } from './auth/context/useAuth'
import { ProtectedRoute } from './auth/components/ProtectedRoute'
import { LoginPage } from './auth/components/LoginPage'
import { SignupPage } from './auth/components/SignupPage'
import { CreateLeaguePage } from './multiplayer/components/CreateLeaguePage'
import { JoinLeaguePage } from './multiplayer/components/JoinLeaguePage'
import { LeagueLobby } from './multiplayer/components/LeagueLobby'
import { useHashRoute } from './router'
import { useLeagueStore } from './store/leagueStore'
import { MainMenu } from './league/components/MainMenu'
import { LeagueScreen } from './league/components/LeagueScreen'
import { CupScreen } from './league/components/CupScreen'
import { MatchScreen } from './match/components/MatchScreen'
import { PlayerSetup } from './multiplayer/components/PlayerSetup'
import { OnlineLeagueScreen } from './multiplayer/components/OnlineLeagueScreen'
import { TeamCreationScreen } from './multiplayer/components/TeamCreationScreen'
import { MultiplayerLobby } from './multiplayer/components/MultiplayerLobby'
import { MultiplayerLeagueScreen } from './multiplayer/components/MultiplayerLeagueScreen'
import { useMultiplayerStore } from './multiplayer/store'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="auth-page">
          <div className="auth-card">
            <h1>Something went wrong</h1>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
            <button onClick={() => { this.setState({ error: null }); window.location.hash = '#/' }}>Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const route = useHashRoute()
  const view = useLeagueStore(s => s.view)
  const mpPhase = useMultiplayerStore(s => s.phase)
  const { user, loading, authError } = useAuth()

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>

  if (authError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Connection Error</h1>
          <p>{authError}</p>
          <p style={{ fontSize: 12, color: '#666' }}>Make sure your Supabase project is active at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" style={{ color: '#646cff' }}>supabase.com/dashboard</a> and the URL + anon key in your Vercel env vars are correct.</p>
        </div>
      </div>
    )
  }

  switch (route.page) {
    case 'login':
      return <LoginPage />
    case 'signup':
      return <SignupPage />
    case 'create-league':
      return <ProtectedRoute><CreateLeaguePage /></ProtectedRoute>
    case 'join':
      return <JoinLeaguePage inviteCode={route.params.code} />
    case 'league':
      return <ProtectedRoute><LeagueLobby leagueId={route.params.id} /></ProtectedRoute>
    case 'draft':
      return <ProtectedRoute>{(user) ? <TeamCreationScreen /> : null}</ProtectedRoute>
    case 'online-league':
      return <ProtectedRoute><OnlineLeagueScreen leagueId={route.params.id} /></ProtectedRoute>
  }

  if (view === 'multiplayer') {
    switch (mpPhase) {
      case 'setup': return <PlayerSetup />
      case 'creating': return <TeamCreationScreen />
      case 'lobby': return <MultiplayerLobby />
      case 'league': return <MultiplayerLeagueScreen />
      default: return <PlayerSetup />
    }
  }

  switch (view) {
    case 'league': return <LeagueScreen />
    case 'cup': return <CupScreen />
    case 'match': return <MatchScreen />
    default: return <MainMenu />
  }
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Configuration Required</h1>
          <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your Vercel environment variables or local <code>.env</code> file.</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
