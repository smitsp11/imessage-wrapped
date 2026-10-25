export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`
  const total = Math.round(minutes)
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${total % 60}m`
}

/** 0.2980 → 29.8 */
export function percent(fraction: number): number {
  return Math.round(fraction * 1000) / 10
}

export function maskHandle(id: string): string {
  if (id.includes('@')) {
    const [user = '', domain = ''] = id.split('@')
    return `${user.slice(0, 1)}•••@${domain}`
  }
  const prefix = id.startsWith('+1') ? '+1 ' : ''
  return `${prefix}••• ••• ${id.replace(/\D/g, '').slice(-4)}`
}
