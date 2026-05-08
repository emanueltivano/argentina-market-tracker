'use client';

import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'argentina-market-tracker:theme';
const THEME_CHANGE_EVENT = 'argentina-market-tracker:theme-change';

type Theme = 'light' | 'dark';

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

    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const initialTheme = getStoredTheme() ?? getSystemTheme();

      setTheme(initialTheme);
      applyTheme(initialTheme);
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
  }

  return (
    <button
      type="button"
      className="theme-toggle-button"
      onClick={handleToggle}
      aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
      aria-pressed={theme === 'dark'}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
