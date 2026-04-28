import { type MarketPanelKey } from '@/lib/market'

type MarketPanelOption = {
  key: MarketPanelKey
  label: string
}

type Props = {
  activePanelKey: MarketPanelKey
  onChange: (key: MarketPanelKey) => void
  options: MarketPanelOption[]
}

export default function PanelMenu({
  activePanelKey,
  onChange,
  options,
}: Props) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Paneles de mercado">
      {options.map((option) => {
        const isActive = option.key === activePanelKey

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              isActive
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </nav>
  )
}