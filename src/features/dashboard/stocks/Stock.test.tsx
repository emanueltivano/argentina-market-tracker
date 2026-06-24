// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Stock from './Stock';
import { type StockData } from '@/features/dashboard/shared/stockData';

const baseStock: StockData = {
  ticker: 'TEST',
  description: 'Test stock',
  price: 100,
  var: 0,
  varType: 'neutral',
  buyQty: 10,
  buyPrice: 99,
  sellPrice: 101,
  sellQty: 20,
  open: 98,
  min: 97,
  max: 102,
  close: 99,
  volume: 1000,
};

function renderStock(overrides: Partial<StockData>) {
  const { container } = render(
    <table>
      <tbody>
        <Stock {...baseStock} {...overrides} />
      </tbody>
    </table>,
  );

  return container.querySelector('.stock-var');
}

describe('Stock', () => {
  it('renders a soft class for mild positive variation', () => {
    const variation = renderStock({ var: 1.2, varType: 'positive' });

    expect(variation?.className).toContain('stock-var-positive');
    expect(variation?.className).toContain('stock-var-soft');
    expect(variation?.className).toContain('stock-var-positive-soft');
    expect(variation?.className).not.toContain('stock-var-medium');
    expect(variation?.className).not.toContain('stock-var-strong');
  });

  it('renders a medium class for mid positive variation', () => {
    const variation = renderStock({ var: 3.4, varType: 'positive' });

    expect(variation?.className).toContain('stock-var-positive');
    expect(variation?.className).toContain('stock-var-medium');
    expect(variation?.className).toContain('stock-var-positive-medium');
    expect(variation?.className).not.toContain('stock-var-strong');
  });

  it('renders a strong class for sharp positive variation', () => {
    const variation = renderStock({ var: 5.1, varType: 'positive' });

    expect(variation?.className).toContain('stock-var-positive');
    expect(variation?.className).toContain('stock-var-strong');
    expect(variation?.className).toContain('stock-var-positive-strong');
  });

  it('keeps a soft class for mild negative variation', () => {
    const variation = renderStock({ var: -1.2, varType: 'negative' });

    expect(variation?.className).toContain('stock-var-negative');
    expect(variation?.className).toContain('stock-var-soft');
    expect(variation?.className).toContain('stock-var-negative-soft');
    expect(variation?.className).not.toContain('stock-var-medium');
    expect(variation?.className).not.toContain('stock-var-strong');
  });

  it('keeps a medium class for mid negative variation', () => {
    const variation = renderStock({ var: -3.4, varType: 'negative' });

    expect(variation?.className).toContain('stock-var-negative');
    expect(variation?.className).toContain('stock-var-medium');
    expect(variation?.className).toContain('stock-var-negative-medium');
    expect(variation?.className).not.toContain('stock-var-strong');
  });

  it('keeps a strong class for sharp negative variation', () => {
    const variation = renderStock({ var: -5.1, varType: 'negative' });

    expect(variation?.className).toContain('stock-var-negative');
    expect(variation?.className).toContain('stock-var-strong');
    expect(variation?.className).toContain('stock-var-negative-strong');
  });

  it('does not add directional severity to neutral variation', () => {
    const variation = renderStock({ var: 0, varType: 'neutral' });

    expect(variation?.className).toContain('stock-var-neutral');
    expect(variation?.className).not.toContain('stock-var-positive');
    expect(variation?.className).not.toContain('stock-var-negative');
    expect(variation?.className).not.toContain('stock-var-soft');
    expect(variation?.className).not.toContain('stock-var-medium');
    expect(variation?.className).not.toContain('stock-var-strong');
  });

  it('shows calculated previous close in the Cierre column', () => {
    renderStock({
      price: 7615,
      var: -4.33,
      varType: 'negative',
      close: 7959.65297376398,
    });

    expect(screen.getByText('$ 7.959,65')).toBeDefined();
  });
});
