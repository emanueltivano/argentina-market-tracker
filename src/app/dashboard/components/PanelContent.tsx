import { type ReactNode } from 'react';

import { type MarketPanelKey } from '@/lib/market';

import PanelMenu from './PanelMenu';
import Title from './PageTitle';
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

        {actions}
      </div>

      <div className="stock-table-container">{children}</div>
    </section>
  );
}
