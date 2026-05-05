import { type MarketPanelKey } from '@/lib/market';

export type MarketPanelOption = {
  key: MarketPanelKey;
  label: string;
  title: string;
  fetchUrl: string;
};

export const MARKET_PANEL_OPTIONS: MarketPanelOption[] = [
  {
    key: 'lider',
    label: 'Panel Líder',
    title: 'Panel Líder',
    fetchUrl: '/api/panel?type=lider',
  },
  {
    key: 'general',
    label: 'Panel General',
    title: 'Panel General',
    fetchUrl: '/api/panel?type=general',
  },
  {
    key: 'cedears',
    label: 'CEDEARs',
    title: 'CEDEARs',
    fetchUrl: '/api/panel?type=cedears',
  },
];

export function getMarketPanelOption(key: MarketPanelKey): MarketPanelOption {
  return (
    MARKET_PANEL_OPTIONS.find((option) => option.key === key) ??
    MARKET_PANEL_OPTIONS[0]
  );
}