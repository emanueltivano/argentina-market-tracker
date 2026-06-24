import StockDetailPageClient from '@/features/dashboard/history/StockDetailPageClient'

type StockPageProps = {
  params: Promise<{
    symbol: string
  }>
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol } = await params

  return <StockDetailPageClient symbol={symbol} />
}
