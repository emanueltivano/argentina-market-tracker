import { useId, type ReactNode } from 'react';
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
  const titleId = useId();

  return (
    <section className="py-4" aria-labelledby={titleId}>
      <Title id={titleId}>{title}</Title>

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
