import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Church, Eye, EyeOff } from 'lucide-react'
import { ROLES } from '../data/roles'
import { MEMBERS } from '../data/mock'
import { pickServingScriptures } from '../data/servingScriptures'
import { USE_API } from '../api/config'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import ColorModeToggle from '../components/ColorModeToggle'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { roleId, setRoleId, memberId, setMemberId, demoMode } = useRole()
  const [remember, setRemember] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [{ primary, secondary }] = useState(() => pickServingScriptures())
  const protocolMembers = MEMBERS.filter((m) => m.role === 'Member')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (USE_API) {
      setSubmitting(true)
      try {
        await login(username.trim(), password)
        navigate('/')
      } catch (err) {
        setError(err.message ?? 'Sign in failed')
      } finally {
        setSubmitting(false)
      }
      return
    }

    navigate('/')
  }

  return (
    <div className="pmss-auth-page pmss-login">
      <div className="pmss-login-toolbar">
        <ColorModeToggle className="pmss-login-theme-toggle" />
      </div>

      <aside className="pmss-login-brand" aria-label="PMSS">
        <div className="pmss-login-brand-glow" aria-hidden />
        <div className="pmss-login-brand-veil" aria-hidden />
        <div className="pmss-login-brand-inner">
          <div className="pmss-login-scripture">
            <span className="pmss-login-scripture-mark" aria-hidden>
              ”
            </span>
            <blockquote className="pmss-login-scripture-text">{primary.text}</blockquote>
            <cite className="pmss-login-scripture-cite">{primary.reference}</cite>
          </div>

          <div className="pmss-login-scripture-secondary">
            <p className="pmss-login-scripture-line">{secondary.text}</p>
            <cite className="pmss-login-scripture-cite pmss-login-scripture-cite--soft">{secondary.reference}</cite>
          </div>

          <div className="pmss-login-brand-foot">
            <div
              className="pmss-auth-mark pmss-login-mark inline-flex w-10 h-10 items-center justify-center text-white"
              style={{ backgroundColor: 'var(--pmss-btn-bg)' }}
              aria-hidden
            >
              <Church className="w-5 h-5" strokeWidth={1.6} />
            </div>
            <p className="pmss-login-brand-wordmark">PMSS</p>
          </div>
        </div>
      </aside>

      <main className="pmss-login-panel">
        <div className="pmss-login-panel-inner">
          <header className="pmss-login-header">
            <p className="pmss-auth-eyebrow pmss-auth-eyebrow--lead">Welcome</p>
            <h1 className="pmss-login-heading">Sign in</h1>
            <p className="pmss-login-lead">Continue to your protocol ministry workspace.</p>
          </header>

          <form onSubmit={handleLogin} className="pmss-login-form">
            <div className="pmss-login-field">
              <label className="pmss-auth-label" htmlFor="login-username">
                Username
                {USE_API && <span className="pmss-auth-required">*</span>}
              </label>
              <input
                id="login-username"
                type="text"
                className="pmss-input pmss-login-input"
                placeholder={USE_API ? 'd.mugisha' : 'your.username'}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={USE_API}
              />
            </div>

            <div className="pmss-login-field">
              <label className="pmss-auth-label" htmlFor="login-password">
                Password
                {USE_API && <span className="pmss-auth-required">*</span>}
              </label>
              <div className="pmss-login-password">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="pmss-input pmss-login-input pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={USE_API}
                />
                <button
                  type="button"
                  className="pmss-login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {demoMode && (
              <div className="pmss-login-demo">
                <div className="pmss-login-field">
                  <label className="pmss-auth-label" htmlFor="login-role">
                    Role preview
                  </label>
                  <select
                    id="login-role"
                    className="pmss-input pmss-login-input"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    aria-label="Role preview"
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                {roleId === 'member' && (
                  <div className="pmss-login-field">
                    <label className="pmss-auth-label" htmlFor="login-member">
                      Member
                    </label>
                    <select
                      id="login-member"
                      className="pmss-input pmss-login-input"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      aria-label="Member preview"
                    >
                      {protocolMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="pmss-login-error" role="alert">
                {error}
              </p>
            )}

            <div className="pmss-login-meta">
              <label className="pmss-login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="pmss-login-checkbox"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="pmss-auth-link text-sm">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="pmss-btn-primary pmss-login-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="pmss-login-footnote">
            Accounts are created by ministry leadership.
            <span>No public registration.</span>
          </p>
        </div>
      </main>
    </div>
  )
}
