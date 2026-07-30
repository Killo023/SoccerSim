import { useState } from 'react'

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/#/join/${inviteCode}`

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="invite-link-card">
      <h3>Invite Friends</h3>
      <p>Share this link to invite players to your league:</p>
      <div className="invite-link-row">
        <input type="text" readOnly value={inviteUrl} className="invite-link-input" />
        <button onClick={copy} className="invite-copy-btn">{copied ? 'Copied!' : 'Copy'}</button>
      </div>
    </div>
  )
}
