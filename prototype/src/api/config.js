const raw = import.meta.env.VITE_API_URL
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

/** Empty string = same origin (unified PMSS server). */
export const API_BASE =
  raw === 'same-origin' || raw === '' ? '' : (raw ?? '').replace(/\/$/, '')

/** Real system: on unless explicitly in demo mode or dev without API URL. */
export const USE_API =
  !demoMode &&
  (Boolean(API_BASE) ||
    raw === 'same-origin' ||
    (import.meta.env.PROD && import.meta.env.VITE_DEMO_MODE !== 'true'))

export const AUTH_TOKEN_KEY = 'pmss-auth-token'
