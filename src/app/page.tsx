import Panel from '@/app/dashboard/components/Panel'
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<div>Cargando panel...</div>}>
      <Panel />
    </Suspense>
  );
}