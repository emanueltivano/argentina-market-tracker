export const STOCK_GRID_LAYOUT = [
  'grid',
  '[grid-template-columns:minmax(78px,1.15fr)_repeat(4,minmax(56px,1fr))]',
  'md:[grid-template-columns:minmax(100px,1.15fr)_repeat(5,minmax(76px,1fr))]',
  'lg:[grid-template-columns:minmax(120px,1.2fr)_repeat(11,minmax(0,1fr))]',
  'items-center',
  'gap-1',
  'sm:gap-2',
  'px-1',
  'py-1.5',
  'sm:px-0',
  'sm:py-2',
  'text-left',
  'whitespace-nowrap',
].join(' ')

export const STOCK_COLUMN_VISIBILITY = {
  desktopOnly: 'hidden lg:block',
  tabletUp: 'hidden md:block',
} as const
