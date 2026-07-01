import { type Theme } from '@/lib/theme'
import ThemeToggle from '@/features/dashboard/shell/ThemeToggle'
import BackToTopButton from './BackToTopButton'

type DashboardFloatingActionsProps = {
  initialTheme?: Theme
}

export default function DashboardFloatingActions({
  initialTheme,
}: DashboardFloatingActionsProps) {
  return (
    <div
      className="dashboard-floating-actions"
      role="group"
      aria-label="Acciones rápidas"
    >
      <BackToTopButton />
      <ThemeToggle
        initialTheme={initialTheme}
        className="dashboard-floating-button"
      />
    </div>
  )
}
