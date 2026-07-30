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
import { TeamCreationScreen } from './multiplayer/components/TeamCreationScreen'
import { MultiplayerLobby } from './multiplayer/components/MultiplayerLobby'
import { MultiplayerLeagueScreen } from './multiplayer/components/MultiplayerLeagueScreen'
import { useMultiplayerStore } from './multiplayer/store'

function AppContent() {
  const route = useHashRoute()
  const view = useLeagueStore(s => s.view)
  const mpPhase = useMultiplayerStore(s => s.phase)
  const { user, loading } = useAuth()

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>

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
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
