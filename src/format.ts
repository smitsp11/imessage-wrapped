/** "4 min", "5h 0m", or past a day "1d 1h" (minutes dropped). */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${total % 60}m`
}

/** 0.2980 → 29.8 */
export function percent(fraction: number): number {
  return Math.round(fraction * 1000) / 10
}

/** Shown when a handle has no contact name: keeps the last 4 digits (and a +1 prefix); emails keep the first letter and the domain. */
export function maskHandle(id: string): string {
  const at = id.lastIndexOf('@')
  if (at !== -1) return `${id.slice(0, 1)}•••@${id.slice(at + 1)}`
  const digits = id.replace(/\D/g, '')
  if (digits.length < 4) return '•••'
  const prefix = id.startsWith('+1') ? '+1 ' : ''
  return `${prefix}••• ••• ${digits.slice(-4)}`
}
