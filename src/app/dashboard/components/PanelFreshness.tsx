const updatedAtFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
});

const updatedAtTitleFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function getUpdatedAt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    label: `Actualizado ${updatedAtFormatter.format(date)}`,
    title: `Última actualización: ${updatedAtTitleFormatter.format(date)}`,
  };
}

type PanelFreshnessProps = {
  fetchedAt: string | undefined;
  isRefreshing: boolean;
};

export default function PanelFreshness({
  fetchedAt,
  isRefreshing,
}: PanelFreshnessProps) {
  const updatedAt = getUpdatedAt(fetchedAt);
  const label = isRefreshing
    ? 'Actualizando...'
    : (updatedAt?.label ?? 'Actualización pendiente');
  const accessibleLabel = isRefreshing
    ? updatedAt
      ? `Actualizando datos. ${updatedAt.title}`
      : 'Actualizando datos'
    : (updatedAt?.title ?? 'Actualización pendiente');

  return (
    <p
      className="panel-freshness-inline"
      aria-label={accessibleLabel}
      aria-live="polite"
      aria-busy={isRefreshing}
      title={updatedAt?.title}
    >
      <span className="panel-freshness-separator" aria-hidden="true">
        ·
      </span>
      <span>{label}</span>
    </p>
  );
}
