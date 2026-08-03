import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Church, Eye, EyeOff } from 'lucide-react'
import { ROLES } from '../data/roles'
import { MEMBERS } from '../data/mock'
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
    <div className="pmss-auth-page flex flex-col">
      <div className="absolute top-3 right-3 z-10">
        <ColorModeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div
              className="pmss-auth-mark inline-flex w-14 h-14 rounded-auth text-white items-center justify-center mb-4 shadow-auth"
              style={{ backgroundColor: 'var(--pmss-btn-bg)' }}
            >
              <Church className="w-7 h-7" strokeWidth={1.75} />
            </div>
            <p className="pmss-auth-eyebrow pmss-auth-eyebrow--lead mb-2">Ministry access</p>
            <h1 className="pmss-auth-title">Sign in</h1>
            <p className="pmss-auth-subtitle text-sm text-neutral-500 mt-3">
              Protocol Management & Scheduling
            </p>
            <p className="text-xs text-neutral-400 mt-2">ADEPR Kacyiru · Authorized users only</p>
          </div>

          <form onSubmit={handleLogin} className="pmss-auth-card space-y-4">
            <div>
              <label className="pmss-auth-label">
                Username
                {USE_API && <span className="pmss-auth-required">*</span>}
              </label>
              <input
                type="text"
                className="pmss-input"
                placeholder={USE_API ? 'd.mugisha' : 'your.username'}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={USE_API}
              />
            </div>
            <div>
              <label className="pmss-auth-label">
                Password
                {USE_API && <span className="pmss-auth-required">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="pmss-input pr-11"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={USE_API}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-link hover:text-link-hover p-1"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {demoMode && (
              <>
                <div>
                  <label className="pmss-auth-label">Role preview</label>
                  <select
                    className="pmss-input"
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
                  <div>
                    <label className="pmss-auth-label">Member</label>
                    <select
                      className="pmss-input"
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
              </>
            )}
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-input px-3 py-2.5" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="pmss-auth-link text-sm">
                Forgot password?
              </Link>
            </div>
            <button type="submit" className="pmss-btn-primary w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-500 mt-6 leading-relaxed">
            Accounts are created by ministry leadership.
            <span className="block text-link mt-1">No public registration.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
