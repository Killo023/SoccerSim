import { useState } from 'react'
import { useAuth } from '../context/useAuth'

export function SignupPage() {
  const { signUp } = useAuth()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signUp(email, password, username, displayName)
      setConfirmSent(true)
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check Your Email</h1>
          <p>A confirmation link has been sent to {email}. Please check your inbox and click the link to confirm your account.</p>
          <a href="#/login" className="auth-link">Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign Up</h1>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} />
          <input type="text" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? 'Creating account...' : 'Create Account'}</button>
        </form>
        <p className="auth-link">Already have an account? <a href="#/login">Login</a></p>
      </div>
    </div>
  )
}
