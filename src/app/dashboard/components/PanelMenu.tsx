import { type MarketPanelKey } from '@/lib/market'
import { type MarketPanelOption } from '../lib/marketPanelOptions'

type PanelMenuOption = Pick<MarketPanelOption, 'key' | 'label'>

type Props = {
  activePanelKey: MarketPanelKey
  onChange: (key: MarketPanelKey) => void
  options: PanelMenuOption[]
}

export default function PanelMenu({
  activePanelKey,
  onChange,
  options,
}: Props) {
  return (
    <nav className="panel-menu" aria-label="Paneles de mercado">
      {options.map((option) => {
        const isActive = option.key === activePanelKey

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={isActive}
            className={`panel-menu-button ${
              isActive ? 'panel-menu-button-active' : ''
            }`}
          >
            {option.key === 'favorites' && (
              <span aria-hidden="true" className="panel-menu-button-icon">
                ☆
              </span>
            )}
            <span>{option.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
