import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import AuthShell from '../layouts/AuthShell'
import { USE_API } from '../api/config'
import { resetPassword } from '../api/client'

function passwordStrength(pwd) {
  if (!pwd) return { label: '', level: 0 }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (pwd.length >= 12) score += 1
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1
  if (score <= 2) return { label: 'Weak', level: 1 }
  if (score <= 3) return { label: 'Fair', level: 2 }
  return { label: 'Strong', level: 3 }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tokenValid = useMemo(
    () => token.length > 0 && (token.startsWith('reset-') || token.startsWith('demo-reset')),
    [token],
  )
  const strength = passwordStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!tokenValid) {
      setError('This reset link is invalid or has expired. Request a new one from the sign-in page.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (USE_API) {
      try {
        await resetPassword(token, password)
        setDone(true)
        return
      } catch (err) {
        setError(err.message ?? 'Reset failed')
        return
      }
    }
    setDone(true)
  }

  if (!tokenValid && !done) {
    return (
      <AuthShell title="Reset password" subtitle="This link is invalid or has expired.">
        <div className="pmss-auth-card space-y-4 text-center">
          <p className="text-sm text-neutral-600">
            Reset links are single-use and expire after one hour. Request a new link from forgot password.
          </p>
          <Link to="/forgot-password" className="pmss-btn-primary w-full h-11 inline-flex items-center justify-center">
            Request new link
          </Link>
          <Link to="/login" className="pmss-btn-outline-accent w-full inline-flex items-center justify-center">
            Back to sign in
          </Link>
        </div>
        <p className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm pmss-auth-link"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={done ? 'Password updated' : 'Reset password'}
      subtitle={
        done ? 'You can now sign in with your new password.' : 'Choose a new password for your ministry account.'
      }
    >
      {done ? (
        <div className="pmss-auth-card space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-neutral-700 text-center">Your password has been reset successfully.</p>
          <button type="button" className="pmss-btn-primary w-full h-11" onClick={() => navigate('/login')}>
            Continue to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="pmss-auth-card space-y-4">
          <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
            <KeyRound className="w-4 h-4 shrink-0 text-neutral-400" />
            <span className="truncate">Secure reset link verified</span>
          </div>
          <div>
            <label htmlFor="new-password" className="pmss-auth-label">
              New password
              <span className="pmss-auth-required">*</span>
            </label>
            <input
              id="new-password"
              type="password"
              className="pmss-input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {password && (
              <p
                className={`text-xs mt-1.5 ${
                  strength.level === 1 ? 'text-amber-600' : strength.level === 2 ? 'text-primary-600' : 'text-emerald-600'
                }`}
              >
                Strength: {strength.label}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="confirm-password" className="pmss-auth-label">
              Confirm password
              <span className="pmss-auth-required">*</span>
            </label>
            <input
              id="confirm-password"
              type="password"
              className="pmss-input"
              placeholder="Re-enter password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {mismatch && <p className="text-xs text-red-600 mt-1.5">Passwords do not match.</p>}
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside">
            <li>Minimum 8 characters</li>
            <li>Use upper and lower case, numbers, and symbols when possible</li>
          </ul>
          <button type="submit" className="pmss-btn-primary w-full h-11">
            Update password
          </button>
        </form>
      )}

      {!done && (
        <p className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm pmss-auth-link"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </p>
      )}

      <p className="text-center text-xs text-neutral-400 mt-6">Internal access only</p>
    </AuthShell>
  )
}
