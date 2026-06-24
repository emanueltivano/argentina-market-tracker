'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  getNextStockSort,
  type StockSort,
  type StockSortKey,
} from '@/features/dashboard/stocks/stockSorting'
import {
  parseStoredStockSort,
  parseStockSortSearchParams,
  resolveInitialStockSort,
  serializeStockSort,
  setStockSortSearchParams,
  STOCK_SORT_STORAGE_KEY,
} from '@/features/dashboard/stocks/stockSortPersistence'

const STOCK_SORT_STORAGE_EVENT = 'stock-sort-storage-change'

function readStoredStockSort() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(STOCK_SORT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredStockSort(sort: StockSort) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STOCK_SORT_STORAGE_KEY, serializeStockSort(sort))
    window.dispatchEvent(new Event(STOCK_SORT_STORAGE_EVENT))
  } catch {
    // Sorting must keep working even if storage is unavailable.
  }
}

function subscribeStoredStockSort(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === STOCK_SORT_STORAGE_KEY) {
      onStoreChange()
    }
  }

  window.addEventListener(STOCK_SORT_STORAGE_EVENT, onStoreChange)
  window.addEventListener('storage', handleStorageChange)

  return () => {
    window.removeEventListener(STOCK_SORT_STORAGE_EVENT, onStoreChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}

function useStoredStockSort() {
  const storedValue = useSyncExternalStore(
    subscribeStoredStockSort,
    readStoredStockSort,
    () => null
  )

  return useMemo(() => parseStoredStockSort(storedValue), [storedValue])
}

export function useStockSortState() {
  const [localSort, setLocalSort] = useState<StockSort | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const storedSort = useStoredStockSort()
  const urlSort = useMemo(
    () => parseStockSortSearchParams(searchParams),
    [searchParams]
  )
  const hasSortSearchParams =
    searchParams.get('sort') !== null || searchParams.get('dir') !== null
  const sort = hasSortSearchParams
    ? urlSort ?? resolveInitialStockSort(searchParams, null)
    : localSort ?? storedSort ?? resolveInitialStockSort(searchParams, null)

  const handleSortChange = useCallback((key: StockSortKey) => {
    const nextSort = getNextStockSort(sort, key)
    const nextParams = new URLSearchParams(searchParams.toString())

    setStockSortSearchParams(nextParams, nextSort)
    writeStoredStockSort(nextSort)
    setLocalSort(nextSort)

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    })
  }, [pathname, router, searchParams, sort])

  return {
    sort,
    handleSortChange,
  }
}
