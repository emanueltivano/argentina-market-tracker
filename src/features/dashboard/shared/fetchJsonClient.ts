type FetchJsonOptions<TSuccess> = {
  assertSuccessResponse(value: unknown): asserts value is TSuccess
  invalidJsonMessage: string
  getError(response: Response, parsedJson?: unknown): Promise<Error>
  parseBeforeHttpError?: boolean
  signal?: AbortSignal
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function responseUrlSuffix(response: Response): string {
  return response.url ? ` (${response.url})` : ''
}

export async function fetchValidatedJson<TSuccess>(
  url: string,
  options: FetchJsonOptions<TSuccess>
): Promise<TSuccess> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: options.signal,
  })

  let json: unknown

  if (response.ok || options.parseBeforeHttpError) {
    try {
      json = await response.json()
    } catch {
      throw new Error(options.invalidJsonMessage)
    }
  }

  if (!response.ok) {
    throw await options.getError(response, json)
  }

  options.assertSuccessResponse(json)

  return json
}
