import 'server-only'
import { ENV } from './env'
import { getCachedToken, setCachedToken, clearCachedToken } from './tokenCache'

/**
 * Configuración general
 */
const TOKEN_TIMEOUT_MS = 15_000
const DEFAULT_REQ_TIMEOUT_MS = 20_000
const MAX_ERROR_BODY_LENGTH = 1_000

type JsonBody = Record<string, unknown> | unknown[]

type IolRequestInit = Omit<RequestInit, 'body'> & {
  body?: RequestInit['body'] | JsonBody | null
}

function devLog(...args: unknown[]) {
  if (ENV.NODE_ENV !== 'production') {
    console.log('[IOL]', ...args)
  }
}

/**
 * Respuesta esperada del endpoint de token OAuth2.
 */
interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

/**
 * Construye un URL absoluto a partir de ENV.API_URL.
 */
function buildUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '')
  return new URL(normalizedPath, `${ENV.API_URL}/`).toString()
}

/**
 * Ejecuta fetch con timeout y limpia siempre el timer.
 */
async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController()
  const parentSignal = init.signal
  let timedOut = false

  const onParentAbort = () => {
    controller.abort()
  }

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort()
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`)
    }

    throw error
  } finally {
    clearTimeout(timer)

    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort)
    }
  }
}

/**
 * Obtiene y cachea un token de acceso.
 */
async function fetchToken(): Promise<string> {
  const cached = getCachedToken()

  if (cached) {
    return cached
  }

  const url = buildUrl(ENV.TOKEN_ENDPOINT)

  const body = new URLSearchParams({
    username: ENV.API_USERNAME,
    password: ENV.API_PASSWORD,
    grant_type: 'password',
  })

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    },
    TOKEN_TIMEOUT_MS,
    'IOL token request'
  )

  if (!res.ok) {
    const text = await safeText(res)
    throw new Error(buildHttpErrorMessage('IOL token fetch failed', res, text))
  }

  const data = await readJson<TokenResponse>(res, 'IOL token response')

  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('IOL token response without access_token')
  }

  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : undefined

  setCachedToken(data.access_token, expiresIn)
  devLog('token obtained, expires_in:', expiresIn ?? '(default)')

  return data.access_token
}

/**
 * Hace una llamada autenticada a IOL.
 *
 * Si el token falla con 401/403, limpia cache, obtiene uno nuevo
 * y reintenta una sola vez.
 */
export async function iol<T>(path: string, init: IolRequestInit = {}): Promise<T> {
  let token = await fetchToken()
  let res = await callWithToken(path, init, token)

  if (res.status === 401 || res.status === 403) {
    devLog('auth failed, retrying once with fresh token')
    clearCachedToken()

    token = await fetchToken()
    res = await callWithToken(path, init, token)
  }

  if (!res.ok) {
    const text = await safeText(res)
    throw new Error(buildHttpErrorMessage('IOL request failed', res, text))
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T
  }

  return readJson<T>(res, 'IOL response')
}

/**
 * Llama a la API con token y timeout por defecto.
 */
async function callWithToken(
  path: string,
  init: IolRequestInit,
  token: string
): Promise<Response> {
  const url = buildUrl(path)
  const headers = new Headers(init.headers)

  if (!headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }

  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }

  const body = normalizeBody(init.body, headers)

  const restInit = { ...init }
  delete restInit.headers
  delete restInit.body
  delete restInit.signal

  const res = await fetchWithTimeout(
    url,
    {
      ...restInit,
      headers,
      body,
      signal: init.signal,
      cache: 'no-store',
    },
    DEFAULT_REQ_TIMEOUT_MS,
    'IOL request'
  )

  devLog('request', init.method ?? 'GET', url, '→', res.status)

  return res
}

/**
 * Si el body es un objeto/array plano, lo serializa como JSON.
 * Si ya es BodyInit válido, lo deja igual.
 */
function normalizeBody(
  body: IolRequestInit['body'],
  headers: Headers
): BodyInit | null | undefined {
  if (body === undefined || body === null) {
    return body
  }

  if (isJsonBody(body)) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    return JSON.stringify(body)
  }

  return body as BodyInit
}

/**
 * Devuelve true solo para objetos/arrays planos que conviene mandar como JSON.
 */
function isJsonBody(body: IolRequestInit['body']): body is JsonBody {
  if (!body || typeof body !== 'object') {
    return false
  }

  if (Array.isArray(body)) {
    return true
  }

  if (body instanceof URLSearchParams) {
    return false
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return false
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return false
  }

  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
    return false
  }

  if (ArrayBuffer.isView(body)) {
    return false
  }

  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    return false
  }

  return Object.getPrototypeOf(body) === Object.prototype
}

/**
 * Lee JSON con error controlado.
 */
async function readJson<T>(res: Response, context: string): Promise<T> {
  const text = await safeText(res)

  if (text === null) {
    throw new Error(`${context}: could not read response body`)
  }

  if (text.trim() === '') {
    throw new Error(`${context}: empty response body`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${context}: invalid JSON response`)
  }
}

/**
 * Intenta leer el cuerpo como texto sin lanzar otra excepción.
 */
async function safeText(res: Response): Promise<string | null> {
  try {
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Construye mensajes HTTP compactos y evita imprimir cuerpos enormes.
 */
function buildHttpErrorMessage(
  prefix: string,
  res: Response,
  text: string | null
): string {
  const statusText = res.statusText ? ` ${res.statusText}` : ''
  const body = formatErrorBody(text)

  return `${prefix}: ${res.status}${statusText}${body ? ` - ${body}` : ''}`
}

function formatErrorBody(text: string | null): string {
  if (!text) {
    return ''
  }

  const normalized = text.trim().replace(/\s+/g, ' ')

  if (normalized.length <= MAX_ERROR_BODY_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_ERROR_BODY_LENGTH)}…`
}

export { iol as iolFetch }
