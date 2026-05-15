import 'server-only'

type LogContext = Record<string, unknown>

function toErrorInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }

  return {
    message: String(error ?? 'unknown'),
  }
}

function cleanContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  )
}

export function logServerError(
  event: string,
  error: unknown,
  context: LogContext = {}
) {
  console.error(`[${event}]`, {
    ...cleanContext(context),
    error: toErrorInfo(error),
  })
}
