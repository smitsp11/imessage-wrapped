/** Messages stores time as nanoseconds since 2001-01-01 UTC. */
export const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1)

/** `ms` = milliseconds since the Apple epoch (the SQL query divides nanoseconds by 1e6). */
export function appleMsToDate(ms: number): Date {
  return new Date(APPLE_EPOCH_MS + ms)
}

export function toAppleNs(date: Date): bigint {
  return BigInt(date.getTime() - APPLE_EPOCH_MS) * 1_000_000n
}
