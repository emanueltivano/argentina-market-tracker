import { type ReactNode } from 'react';
import { type MarketPanelKey } from '@/lib/market';
import PanelMenu from './PanelMenu';
import Title from './PageTitle';
import { MARKET_PANEL_OPTIONS } from '../lib/panelOptions';

type PanelContentProps = {
  title: string;
  activePanelKey: MarketPanelKey;
  onChange: (key: MarketPanelKey) => void;
  children: ReactNode;
};

export default function PanelContent({
  title,
  activePanelKey,
  onChange,
  children,
}: PanelContentProps) {
  return (
    <section className="py-4">
      <Title>{title}</Title>

      <PanelMenu
        activePanelKey={activePanelKey}
        onChange={onChange}
        options={MARKET_PANEL_OPTIONS}
      />

      <div className="overflow-x-auto">
        {children}
      </div>
    </section>
  );
}
