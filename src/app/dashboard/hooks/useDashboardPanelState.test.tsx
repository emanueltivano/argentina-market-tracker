// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardPanelState } from './useDashboardPanelState';

const replace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace }),
  useSearchParams: () => currentSearchParams,
}));

describe('useDashboardPanelState', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    replace.mockReset();
  });

  it('uses the default panel when the url does not contain a valid panel', () => {
    const { result } = renderHook(() =>
      useDashboardPanelState({
        defaultPanel: 'lider',
        sort: { key: 'ticker', direction: 'asc' },
      }),
    );

    expect(result.current.activePanelKey).toBe('lider');
    expect(result.current.dataPanelKey).toBe('lider');
    expect(result.current.isFavoritesPanel).toBe(false);
  });

  it('keeps the last data panel as the source when switching to favorites', () => {
    currentSearchParams = new URLSearchParams('panel=general');
    const { result, rerender } = renderHook(() =>
      useDashboardPanelState({
        defaultPanel: 'lider',
        sort: { key: 'ticker', direction: 'asc' },
      }),
    );

    act(() => {
      result.current.handlePanelChange('favorites');
    });

    expect(replace).toHaveBeenCalledWith('/?panel=favorites&sort=ticker&dir=asc', {
      scroll: false,
    });

    currentSearchParams = new URLSearchParams('panel=favorites');
    rerender();

    expect(result.current.activePanelKey).toBe('favorites');
    expect(result.current.dataPanelKey).toBe('general');
    expect(result.current.isFavoritesPanel).toBe(true);
  });

  it('updates the source panel after leaving favorites', () => {
    currentSearchParams = new URLSearchParams('panel=favorites');
    const { result, rerender } = renderHook(() =>
      useDashboardPanelState({
        defaultPanel: 'lider',
        sort: { key: 'ticker', direction: 'asc' },
      }),
    );

    act(() => {
      result.current.handlePanelChange('cedears');
    });

    expect(replace).toHaveBeenCalledWith('/?panel=cedears&sort=ticker&dir=asc', {
      scroll: false,
    });

    currentSearchParams = new URLSearchParams('panel=cedears');
    rerender();

    expect(result.current.activePanelKey).toBe('cedears');
    expect(result.current.dataPanelKey).toBe('cedears');
    expect(result.current.isFavoritesPanel).toBe(false);
  });
});
