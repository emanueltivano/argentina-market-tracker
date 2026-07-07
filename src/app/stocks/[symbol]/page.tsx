import StockDetailPageClient from '@/features/dashboard/stock-detail/StockDetailPageClient'

type StockPageProps = {
  params: Promise<{
    symbol: string
  }>
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol } = await params

  return <StockDetailPageClient symbol={symbol} />
}
