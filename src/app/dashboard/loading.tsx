export default function Loading() {
  return (
    <div className="p-4 animate-pulse" aria-busy="true" role="status">
      <span className="sr-only">Cargando panel...</span>

      <div className="mb-3 h-6 w-40 rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
    </div>
  )
}