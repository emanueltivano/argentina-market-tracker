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
  stale?: boolean;
};

export default function PanelFreshness({
  fetchedAt,
  isRefreshing,
  stale = false,
}: PanelFreshnessProps) {
  const updatedAt = getUpdatedAt(fetchedAt);
  const label = stale
    ? updatedAt
      ? `Datos desactualizados · ${updatedAt.label}`
      : 'Datos desactualizados'
    : isRefreshing
    ? 'Actualizando...'
    : (updatedAt?.label ?? 'Actualización pendiente');
  const accessibleLabel = stale
    ? updatedAt
      ? `Datos posiblemente desactualizados. ${updatedAt.title}`
      : 'Datos posiblemente desactualizados'
    : isRefreshing
    ? updatedAt
      ? `Actualizando datos. ${updatedAt.title}`
      : 'Actualizando datos'
    : (updatedAt?.title ?? 'Actualización pendiente');

  return (
    <p
      className="panel-freshness-inline"
      data-stale={stale || undefined}
      aria-label={accessibleLabel}
      aria-live="polite"
      aria-busy={isRefreshing}
      title={updatedAt?.title}
    >
      <span>{label}</span>
    </p>
  );
}
