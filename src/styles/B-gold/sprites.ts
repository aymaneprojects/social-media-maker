import {SPRITES as SPRITES_A} from '../A-hud/sprites';

// Extra sprites for style B (gold legend, see colorsB). Used as fallbacks
// when no AI illustration exists and as small icons (clues, grids, lists).
const EXTRA: Record<string, string[]> = {
  bulb: ['...WWWW...', '..WWWWWW..', '.WWWAAWWW.', '.WWAWWAWW.', '.WWWAAWWW.', '..WWWWWW..', '...WWWW...', '...ssss...', '...ssss...', '....ss....'],
  magnifier: ['..oooo....', '.o....o...', 'o..WW..o..', 'o.W....o..', 'o......o..', '.o....o...', '..oooooo..', '......ooo.', '.......ooo', '........oo'],
  document: ['WWWWWWWW..', 'WkkkkkkWW.', 'WWWWWWWWWW', 'WkkkkkkkkW', 'WWWWWWWWWW', 'WkkkkkkWWW', 'WWWWWWWWWW', 'WkkkkkkkkW', 'WWWWWWWWWW', 'WWWWWWrrWW'],
  coins: ['..AAAAAA..', '.AoooooooA', 'AAAAAAAAAA', '.AoooooooA', 'AAAAAAAAAA', '.AoooooooA', 'AAAAAAAAAA', '.nnnnnnnn.'],
  bill: ['gggggggggggggg', 'gWWWWWWWWWWWWg', 'gWgggWWWWgggWg', 'gWgWgWggWgWgWg', 'gWgggWWWWgggWg', 'gWWWWWWWWWWWWg', 'gggggggggggggg'],
  building: ['....oooo....', '....oAAo....', '..oooooooo..', '..oAoAoAoo..', '..oooooooo..', '..oAoAoAoo..', 'oooooooooooo', 'oAoAoAoAoAoo', 'oooooooooooo', 'oAoAoAoAoAoo', 'oooooooooooo', 'ooooommooooo'],
  rocket: ['....WW....', '...WWWW...', '...WrrW...', '...WWWW...', '...WuuW...', '...WWWW...', '..sWWWWs..', '.ssWWWWss.', '.s.AAAA.s.', '...rAAr...', '....rr....'],
  planet: ['....oooo....', '..oooooooo..', '.oooAAooooo.', 'WWWWWWWWWWWW', '.ooooooAAoo.', '..oooooooo..', '....oooo....'],
  flask: ['...ss...', '...ss...', '...ss...', '..s..s..', '.s....s.', 's.gggg.s', 'sggggggs', 'ssssssss'],
  lock: ['..oooo..', '.o....o.', '.o....o.', 'AAAAAAAA', 'AAAkkAAA', 'AAAkkAAA', 'AAAAAAAA'],
  dice: ['WWWWWWW', 'WkWWWkW', 'WWWWWWW', 'WWWkWWW', 'WWWWWWW', 'WkWWWkW', 'WWWWWWW'],
  target: ['..rrrrr..', '.rWWWWWr.', 'rWrrrrrWr', 'rWrWWWrWr', 'rWrWrWrWr', 'rWrWWWrWr', 'rWrrrrrWr', '.rWWWWWr.', '..rrrrr..'],
  shirt: ['.WWW.WWW.', 'WWWWWWWWW', 'WWWWWWWWW', '.WWWWWWW.', '.WWWWWWW.', '.WWWWWWW.', '.WWWWWWW.'],
  eye: ['...WWWWW...', '.WW.....WW.', 'W...ooo...W', 'W..ookoo..W', 'W...ooo...W', '.WW.....WW.', '...WWWWW...'],
  head: ['..nnnn..', '.nnnnnn.', '.nWnnWn.', '.nnnnnn.', '..nnnn..', '...nn...', '.AAAAAA.', 'AAAAAAAA'],
  pigeon: ['...ss.....', '..sWss....', '..sssr....', '.sssssssss', 'sssssssss.', '..sssss...', '...o..o...'],
  tower: ['....A....', '...ooo...', '...ooo...', '..ooooo..', '..o.o.o..', '.ooooooo.', '.o.o.o.o.', 'ooooooooo'],
  scale: ['....A....', 'AAAAAAAAA', 'A...A...A', 'A...A...A', 'oo..A..oo', '....A....', '..AAAAA..'],
  cross: ['r.....r', '.r...r.', '..r.r..', '...r...', '..r.r..', '.r...r.', 'r.....r'],
  checkG: ['......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'],
  calendar: ['.o..o.', 'AAAAAA', 'WWWWWW', 'WkWkWk', 'WWWWWW', 'WkWkWr', 'WWWWWW'],
  gem: ['.uuuu.', 'uWuuWu', 'uuuuuu', '.uuuu.', '..uu..'],
  atom: ['..o...o..', '...o.o...', 'oooAAAooo', '...AWA...', 'oooAAAooo', '...o.o...', '..o...o..'],
};

export const SPRITES_B: Record<string, string[]> = {...SPRITES_A, ...EXTRA};
