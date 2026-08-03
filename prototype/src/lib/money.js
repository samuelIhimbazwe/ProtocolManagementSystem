/** Format Rwandan Franc amounts for display. */
export function formatRwf(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `${new Intl.NumberFormat('en-RW').format(Math.round(n))} RWF`
}

export function parseAmountInput(value) {
  const n = Number(String(value).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : NaN
}

export const SUBMISSION_STATUS_LABEL = {
  pending: 'Pending Verification',
  confirmed: 'Confirmed',
  partial: 'Partially Confirmed',
  declined: 'Declined',
}

export const FREQUENCY_LABEL = {
  one_time: 'One-Time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  continuous: 'Continuous',
}
