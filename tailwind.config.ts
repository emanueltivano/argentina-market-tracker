import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-muted': 'var(--surface-muted)',
        'surface-subtle': 'var(--surface-subtle)',
        text: 'var(--text-color)',
        muted: 'var(--muted-text)',
        accent: 'var(--main-color)',
        'accent-light': 'var(--main-light-color)',
        border: 'var(--border-color)',
        'border-strong': 'var(--border-strong)',
        positive: 'var(--positive-color)',
        negative: 'var(--negative-color)',
        warning: 'var(--warning-color)',
      },
      container: {
        center: true,
        padding: '1rem',
      },
      boxShadow: {
        panel: 'var(--table-shadow)',
      },
    },
  },
  plugins: [],
}

export default config
