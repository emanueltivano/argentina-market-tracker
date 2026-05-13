import { type ReactNode } from 'react';
import Link from 'next/link';

import { type MarketPanelKey } from '@/lib/market';

import PanelMenu from './PanelMenu';
import Title from './PageTitle';
import ThemeToggle from './ThemeToggle';
import { MARKET_PANEL_OPTIONS } from '../lib/marketPanelOptions';

type PanelContentProps = {
  title: string;
  activePanelKey: MarketPanelKey;
  onChange: (key: MarketPanelKey) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export default function PanelContent({
  title,
  activePanelKey,
  onChange,
  actions,
  children,
}: PanelContentProps) {
  return (
    <section className="dashboard-container py-4">
      <Title>{title}</Title>

      <div className="panel-toolbar">
        <PanelMenu
          activePanelKey={activePanelKey}
          onChange={onChange}
          options={MARKET_PANEL_OPTIONS}
        />

        <div className="panel-actions">
          <Link className="panel-about-link" href="/about">
            About
          </Link>
          <ThemeToggle />
          {actions}
        </div>
      </div>

      <div className="stock-table-container">{children}</div>
    </section>
  );
}
