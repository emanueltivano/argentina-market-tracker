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
  onRefresh: () => Promise<void>;
};

export default function PanelFreshness({
  fetchedAt,
  isRefreshing,
  onRefresh,
}: PanelFreshnessProps) {
  const handleRefresh = () => {
    if (isRefreshing) return;

    void onRefresh().catch(() => undefined);
  };

  return (
    <div className="panel-refresh">
      <p aria-live="polite">{formatUpdatedAt(fetchedAt)}</p>

      <button
        type="button"
        className={`panel-refresh-button${isRefreshing ? ' loading' : ''}`}
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-busy={isRefreshing}
      >
        {isRefreshing ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>
  );
}
