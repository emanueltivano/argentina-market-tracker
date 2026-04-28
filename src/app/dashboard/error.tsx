'use client'

type ErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="p-4" role="alert">
      <h2 className="mb-2 font-semibold text-red-600">
        No se pudo cargar el panel
      </h2>

      <p className="mb-3 text-sm text-gray-600">{error.message}</p>

      <button type="button" onClick={reset} className="rounded border px-3 py-2">
        Reintentar
      </button>
    </div>
  )
}