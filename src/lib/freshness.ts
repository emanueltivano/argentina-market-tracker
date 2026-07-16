export type CacheStatus = 'fresh' | 'memory-cache' | 'stale'
export type DegradationReason = 'upstream-unavailable'

const SERVER_ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function isServerIsoTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !SERVER_ISO_TIMESTAMP_PATTERN.test(value)
  ) {
    return false
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

export function isValidFreshnessContract(
  value: Record<string, unknown>
): boolean {
  if (
    !isServerIsoTimestamp(value.fetchedAt) ||
    !isServerIsoTimestamp(value.servedAt) ||
    !isServerIsoTimestamp(value.staleUntil)
  ) {
    return false
  }

  const fetchedAt = Date.parse(value.fetchedAt)
  const servedAt = Date.parse(value.servedAt)
  const staleUntil = Date.parse(value.staleUntil)

  if (
    fetchedAt > servedAt ||
    fetchedAt >= staleUntil ||
    servedAt > staleUntil
  ) {
    return false
  }

  if (value.cacheStatus === 'stale') {
    return (
      value.stale === true &&
      value.degradationReason === 'upstream-unavailable'
    )
  }

  if (
    value.cacheStatus === 'fresh' ||
    value.cacheStatus === 'memory-cache'
  ) {
    return value.stale === false && value.degradationReason === undefined
  }

  return false
}
