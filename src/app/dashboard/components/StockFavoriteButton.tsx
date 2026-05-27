type StockFavoriteButtonProps = {
  ticker: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  className?: string;
};

export default function StockFavoriteButton({
  ticker,
  isFavorite = false,
  onToggleFavorite,
  className = '',
}: StockFavoriteButtonProps) {
  return (
    <button
      type="button"
      className={`stock-favorite-button ${
        isFavorite ? 'stock-favorite-button-active' : ''
      } ${className}`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite?.();
      }}
      aria-label={
        isFavorite
          ? `Quitar ${ticker} de favoritos`
          : `Agregar ${ticker} a favoritos`
      }
      aria-pressed={isFavorite}
      title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}
