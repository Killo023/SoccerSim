import type { ReactNode } from 'react'
import { useAuth } from '../context/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Login Required</h1>
          <p>You need to be logged in to access this page.</p>
          <a href="#/login" className="auth-link">Go to Login</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
