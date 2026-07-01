'use client'

import { useEffect, useState } from 'react'

const SCROLL_TOP_THRESHOLD = 300

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > SCROLL_TOP_THRESHOLD)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <button
      type="button"
      className="ui-icon-button dashboard-floating-button dashboard-scroll-top-button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      aria-label="Subir al inicio"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 5l0 14" />
        <path d="M18 11l-6 -6" />
        <path d="M6 11l6 -6" />
      </svg>
    </button>
  )
}
