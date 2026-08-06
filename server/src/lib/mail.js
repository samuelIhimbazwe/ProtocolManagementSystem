/**
 * Outbound mail helpers. Wire SMTP later via env (e.g. SMTP_URL / RESEND_API_KEY).
 * Until then, invites are recorded and logged so the destination email is always captured.
 */
export async function sendInviteEmail({ to, displayName, username, tempPassword }) {
  const payload = {
    to,
    subject: 'You are invited to PMSS',
    text: [
      `Hello ${displayName},`,
      '',
      'You have been invited to Protocol Management & Scheduling (PMSS).',
      `Username: ${username}`,
      tempPassword ? `Temporary password: ${tempPassword}` : null,
      '',
      'Sign in and change your password after first login.',
      '',
      '— Ministry leadership',
    ]
      .filter(Boolean)
      .join('\n'),
  }

  // Placeholder for a real provider. Always log in non-silent mode for pilot visibility.
  console.log('[pmss-mail] invite queued', { to: payload.to, username, hasTempPassword: Boolean(tempPassword) })

  return {
    sent: false,
    queued: true,
    provider: 'log',
    to: payload.to,
  }
}
