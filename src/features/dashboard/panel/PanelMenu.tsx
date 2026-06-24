'use client'

import { type MarketPanelKey } from '@/lib/market'
import { type MarketPanelOption } from '@/features/dashboard/panel/marketPanelOptions'
import { useEffect, useId, useRef, useState } from 'react'

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
  const mobileMenuId = useId()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLElement>(null)
  const wasMobileMenuOpenRef = useRef(false)

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (!window.matchMedia) {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 769px)')

    function handleViewportChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setIsMobileMenuOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange)
    }
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      mobileMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    } else if (wasMobileMenuOpenRef.current) {
      toggleButtonRef.current?.focus()
    }

    wasMobileMenuOpenRef.current = isMobileMenuOpen
  }, [isMobileMenuOpen])

  function handlePanelChange(key: MarketPanelKey) {
    onChange(key)
    setIsMobileMenuOpen(false)
  }

  function renderMenuButton(option: PanelMenuOption) {
    const isActive = option.key === activePanelKey

    return (
      <button
        key={option.key}
        type="button"
        onClick={() => handlePanelChange(option.key)}
        aria-pressed={isActive}
        aria-label={`Mostrar panel ${option.label}`}
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
  }

  return (
    <div ref={rootRef} className="panel-menu-root">
      <nav className="panel-menu panel-menu-desktop" aria-label="Paneles de mercado">
        {options.map(renderMenuButton)}
      </nav>

      <div className="panel-menu-mobile">
        <button
          ref={toggleButtonRef}
          type="button"
          className="panel-menu-toggle"
          aria-expanded={isMobileMenuOpen}
          aria-controls={mobileMenuId}
          aria-label={
            isMobileMenuOpen
              ? 'Cerrar navegación de paneles'
              : 'Abrir navegación de paneles'
          }
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          <span aria-hidden="true" className="panel-menu-toggle-icon">
            <span />
            <span />
            <span />
          </span>
          <span>Paneles</span>
        </button>

        {isMobileMenuOpen && (
          <nav
            id={mobileMenuId}
            ref={mobileMenuRef}
            className="panel-menu-mobile-panel"
            aria-label="Paneles de mercado"
          >
            {options.map(renderMenuButton)}
          </nav>
        )}
      </div>
    </div>
  )
}
