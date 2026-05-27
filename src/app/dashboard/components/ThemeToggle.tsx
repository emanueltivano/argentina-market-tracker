'use client';

import { useEffect, useState } from 'react';
import {
  THEME_CHANGE_EVENT,
  THEME_COOKIE_MAX_AGE_SEC,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type Theme,
  isTheme,
} from '@/lib/theme';

type ThemeToggleProps = {
  initialTheme?: Theme;
};

function getSystemTheme(): Theme {
  if (!window.matchMedia) {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function getDocumentTheme(): Theme | null {
  if (document.documentElement.classList.contains('dark')) {
    return 'dark';
  }

  if (document.documentElement.classList.contains('light')) {
    return 'light';
  }

  return null;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export default function ThemeToggle({ initialTheme = 'light' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextTheme = getDocumentTheme() ?? getStoredTheme() ?? getSystemTheme();

      setTheme(nextTheme);
      applyTheme(nextTheme);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function handleToggle() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme switching should still work when storage is unavailable.
    }

    document.cookie = `${THEME_COOKIE_NAME}=${nextTheme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  }

  const ariaLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro';
  const ariaPressed = theme === 'dark';
  const icon = theme === 'dark' ? '☀' : '☾';
  const label = theme === 'dark' ? 'Claro' : 'Oscuro';

  return (
    <button
      type="button"
      className="theme-toggle-button"
      onClick={handleToggle}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
