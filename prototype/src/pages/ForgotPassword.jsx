import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import AuthShell from '../layouts/AuthShell'
import { USE_API } from '../api/config'
import { forgotPassword } from '../api/client'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [resetLink, setResetLink] = useState('/reset-password')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (USE_API) {
      try {
        const data = await forgotPassword(email.trim())
        if (data.demoResetUrl) setResetLink(data.demoResetUrl)
      } catch {
        /* still show generic success */
      }
    }
    setSent(true)
  }

  const demoResetUrl =
    USE_API && resetLink.startsWith('/')
      ? resetLink
      : `/reset-password?token=demo-reset-${encodeURIComponent(email || 'user')}`

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter the email on your account. We will send reset instructions if it matches."
    >
      {sent ? (
        <div className="pmss-auth-card space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-neutral-700 text-center">
            If an account exists for <strong className="text-neutral-900">{email || 'that email'}</strong>, reset
            instructions have been sent.
          </p>
          <p className="text-xs text-neutral-500 text-center">
            Links expire after 1 hour. Contact your coordinator if you do not receive an email.
          </p>
          {!USE_API && (
            <Link to={demoResetUrl} className="pmss-btn-secondary w-full h-11 inline-flex items-center justify-center">
              Continue with reset link
            </Link>
          )}
          <button type="button" className="pmss-btn-primary w-full" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="pmss-auth-card space-y-4">
          <div>
            <label htmlFor="forgot-email" className="pmss-auth-label">
              Email
              <span className="pmss-auth-required">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              className="pmss-input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-neutral-400">
            For security, we do not confirm whether an email exists. Only ministry-issued accounts can reset
            passwords.
          </p>
          <button type="submit" className="pmss-btn-primary w-full h-11">
            Send reset instructions
          </button>
        </form>
      )}

      <p className="text-center mt-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm pmss-auth-link"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
      </p>

      <p className="text-center text-xs text-neutral-400 mt-6">Internal access only · No public registration</p>
    </AuthShell>
  )
}
