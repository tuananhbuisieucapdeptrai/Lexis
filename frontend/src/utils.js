export function formatDate(value) {
  if (!value) return 'Recently'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function statusLabel(status) {
  if (!status) return 'draft'
  return status.replaceAll('_', ' ')
}
