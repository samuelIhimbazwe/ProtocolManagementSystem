import { useState } from 'react'
import Modal from './Modal'
import { useAuth } from '../context/AuthContext'
import { changePassword } from '../api/client'

/** Blocking dialog when the account was provisioned with a shared default password. */
export default function ForcePasswordChangeModal() {
  const { user, markPasswordChanged } = useAuth()
  const open = Boolean(user?.mustChangePassword)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (newPassword === currentPassword) {
      setError('Choose a new password different from the temporary one')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      markPasswordChanged()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message ?? 'Could not update password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => {}}
      dismissible={false}
      title="Change your password"
      description="Your account was set up with a temporary shared password. Choose a new password before continuing."
      footer={
        <button type="submit" form="force-password-form" className="pmss-btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      }
    >
      <form id="force-password-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-neutral-600">
          Signed in as <span className="font-medium text-neutral-900">{user?.username}</span>
        </p>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="force-current-password">
            Temporary password
          </label>
          <input
            id="force-current-password"
            type="password"
            className="pmss-input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="force-new-password">
            New password
          </label>
          <input
            id="force-new-password"
            type="password"
            className="pmss-input"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5" htmlFor="force-confirm-password">
            Confirm new password
          </label>
          <input
            id="force-confirm-password"
            type="password"
            className="pmss-input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  )
}
