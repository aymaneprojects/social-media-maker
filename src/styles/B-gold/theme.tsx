import React, {createContext, useContext} from 'react';
import type {PaletteB} from '../../shared/palette';
import type {Brand} from '../../shared/schema';
import type {AssetMap} from './stage';

export type ThemeB = {pal: PaletteB; brand: Brand; issue: number; assetsBase: string; assets: AssetMap};

const Ctx = createContext<ThemeB | null>(null);

export const ThemeProviderB: React.FC<{value: ThemeB; children: React.ReactNode}> = ({value, children}) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export const useThemeB = () => {
  const t = useContext(Ctx);
  if (!t) throw new Error('ThemeB missing');
  return t;
};

export type SceneProps<P = Record<string, unknown>> = {params: P; durationMs: number; ms: number};

// Sprite colours for style B: the style-A sprite legend remapped to gold.
export const colorsB = (pal: PaletteB) => ({
  A: pal.gold,
  D: pal.goldDeep,
  W: pal.cream,
  P: pal.cream,
  m: pal.goldDeep,
  n: pal.goldDark,
  o: pal.gold,
  p: '#1A1003',
  q: '#2A1A06',
  k: pal.black,
  b: pal.bg,
  r: pal.red,
  g: pal.green,
  u: pal.water,
  s: pal.grey,
});
