import React, {createContext, useContext} from 'react';
import type {PaletteA} from '../../shared/palette';
import type {Brand} from '../../shared/schema';

export type ThemeA = {
  pal: PaletteA;
  brand: Brand;
  issue: number;
  assetsBase: string;
  // timing of the scene currently rendered (ms, relative to scene start)
};

const Ctx = createContext<ThemeA | null>(null);

export const ThemeProviderA: React.FC<{value: ThemeA; children: React.ReactNode}> = ({value, children}) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useThemeA = () => {
  const t = useContext(Ctx);
  if (!t) throw new Error('ThemeA missing');
  return t;
};

// Props every style-A scene receives.
export type SceneProps<P = Record<string, unknown>> = {
  params: P;
  durationMs: number; // duration of the beat
  ms: number; // time since the beat started
};

// Layout constants measured on the reference (576x1024) and scaled x1.875.
export const LAYOUT = {
  captionY: 1225, // vertical centre of the caption line
  safeTop: 260,
  safeBottom: 1500,
  bracketInset: {x: 24, top: 156, bottom: 1772},
  badge: {x: 49, y: 178, h: 45},
} as const;
