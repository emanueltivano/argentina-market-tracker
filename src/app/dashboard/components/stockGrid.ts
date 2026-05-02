export const STOCK_GRID_LAYOUT = [
  'grid',
  '[grid-template-columns:minmax(78px,1.2fr)_repeat(2,minmax(64px,1fr))]',
  'md:[grid-template-columns:minmax(100px,1.15fr)_repeat(5,minmax(76px,1fr))]',
  'lg:[grid-template-columns:minmax(120px,1.2fr)_repeat(11,minmax(0,1fr))]',
  'items-center',
  'gap-0',
  'ps-2',
  'py-0',
  'sm:px-0',
  'sm:py-0',
  'text-left',
  'whitespace-nowrap',
].join(' ')

export const STOCK_COLUMN_VISIBILITY = {
  desktopOnly: 'hidden lg:table-cell',
  tabletUp: 'hidden md:table-cell',
} as const
