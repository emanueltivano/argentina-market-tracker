const updatedAtFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatUpdatedAt(value: string | undefined): string {
  if (!value) {
    return 'Última actualización no disponible';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Última actualización no disponible';
  }

  return `Última actualización: ${updatedAtFormatter.format(date)}`;
}

type PanelFreshnessProps = {
  fetchedAt: string | undefined;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export default function PanelFreshness({
  fetchedAt,
  isRefreshing,
  onRefresh,
}: PanelFreshnessProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
      <p aria-live="polite">{formatUpdatedAt(fetchedAt)}</p>
      <button
        type="button"
        className="panel-refresh-button"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>
  );
}
