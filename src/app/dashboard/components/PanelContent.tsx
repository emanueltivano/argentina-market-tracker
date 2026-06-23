import { type ReactNode, useId } from 'react';
import Link from 'next/link';

import { type MarketPanelKey } from '@/lib/market';

import PanelMenu from './PanelMenu';
import Title from './PageTitle';
import ThemeToggle from './ThemeToggle';
import { MARKET_PANEL_OPTIONS } from '../lib/marketPanelOptions';
import { type Theme } from '@/lib/theme';

type PanelContentProps = {
  title: string;
  activePanelKey: MarketPanelKey;
  initialTheme?: Theme;
  isDemoMode?: boolean;
  onChange: (key: MarketPanelKey) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export default function PanelContent({
  title,
  activePanelKey,
  initialTheme,
  isDemoMode = false,
  onChange,
  actions,
  children,
}: PanelContentProps) {
  const titleId = useId();

  return (
    <section className="dashboard-container py-4" aria-labelledby={titleId}>
      <Title id={titleId}>{title}</Title>

      <div className="panel-toolbar">
        <PanelMenu
          activePanelKey={activePanelKey}
          onChange={onChange}
          options={MARKET_PANEL_OPTIONS}
        />

        <div className="panel-actions">
          {isDemoMode && (
            <span
              className="ui-pill ui-pill-warning panel-demo-badge"
              aria-label="Demo data badge"
            >
              Demo data
            </span>
          )}
          <Link
            className="ui-button ui-button-secondary panel-about-link"
            href="/about"
          >
            About
          </Link>
          <ThemeToggle initialTheme={initialTheme} />
          {actions}
        </div>
      </div>

      <div className="stock-table-container">{children}</div>
    </section>
  );
}
