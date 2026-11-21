import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { load, save } from './storage';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  haptics: boolean;
  /** Sudoku: mark digits that don't match the solution as soon as they're entered. */
  showMistakes: boolean;
}

const DEFAULTS: Settings = { theme: 'system', haptics: true, showMistakes: true };

interface SettingsContext {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsContext>({ settings: DEFAULTS, update: () => {} });

const THEME_COLORS = { light: '#f5f1e8', dark: '#0c0e11' };

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load('settings', {}) }));

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save('settings', next);
      return next;
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);

/** Short vibration for touch feedback, when the phone supports it and the player wants it. */
export function useHaptics() {
  const { settings } = useSettings();
  return useCallback(
    (pattern: number | number[]) => {
      if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(pattern);
    },
    [settings.haptics],
  );
}
