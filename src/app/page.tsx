import Panel from '@/app/dashboard/components/Panel'
import PanelLoadingSkeleton from '@/app/dashboard/components/PanelLoadingSkeleton'
import { Suspense } from 'react'

export default function Home() {
  return (
    <Suspense fallback={<PanelLoadingSkeleton />}>
      <Panel />
    </Suspense>
  )
}
