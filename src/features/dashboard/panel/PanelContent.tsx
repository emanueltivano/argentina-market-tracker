import { type ReactNode, useId } from 'react';
import Link from 'next/link';

import { type MarketPanelKey } from '@/lib/market';

import PanelMenu from './PanelMenu';
import Title from '@/features/dashboard/shell/PageTitle';
import ThemeToggle from '@/features/dashboard/shell/ThemeToggle';
import { MARKET_PANEL_OPTIONS } from '@/features/dashboard/panel/marketPanelOptions';
import { type Theme } from '@/lib/theme';

type PanelContentProps = {
  title: string;
  activePanelKey: MarketPanelKey;
  initialTheme?: Theme;
  isDemoMode?: boolean;
  onChange: (key: MarketPanelKey) => void;
  status?: ReactNode;
  children: ReactNode;
};

export default function PanelContent({
  title,
  activePanelKey,
  initialTheme,
  isDemoMode = false,
  onChange,
  status,
  children,
}: PanelContentProps) {
  const titleId = useId();

  return (
    <section className="dashboard-container py-4" aria-labelledby={titleId}>
      <Title id={titleId}>{title}</Title>

      <div className="panel-toolbar">
        <div className="panel-menu-status">
          <PanelMenu
            activePanelKey={activePanelKey}
            onChange={onChange}
            options={MARKET_PANEL_OPTIONS}
          />

          <div className="panel-status">
            {isDemoMode && (
              <span
                className="ui-pill ui-pill-warning panel-demo-badge"
                aria-label="Demo pública con datos sintéticos"
                title="El deploy público usa datos sintéticos determinísticos para estabilidad y seguridad."
              >
                Demo público · datos sintéticos
              </span>
            )}
            {status}
          </div>
        </div>

        <div className="panel-actions">
          <ThemeToggle initialTheme={initialTheme} />
        </div>
      </div>

      <div className="stock-table-container">{children}</div>

      <footer className="dashboard-project-footer">
        <p>Información sobre los datos y las decisiones técnicas del proyecto.</p>
        <Link
          className="ui-button ui-button-secondary dashboard-project-link"
          href="/about"
        >
          Datos y proyecto
        </Link>
      </footer>
    </section>
  );
}
