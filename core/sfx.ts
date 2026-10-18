// Synthesises the sound library with ffmpeg (no third-party samples, no
// licensing questions): UI beeps, stamps, glitches, whooshes and ambience
// loops matching the reference sound design.
//   npx tsx core/sfx.ts            -> writes public/sfx/*.wav|mp3
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/sfx');
mkdirSync(OUT, {recursive: true});

type Def = {name: string; src: string; d: number; af?: string; mp3?: boolean};

// aevalsrc expressions: t = time (s). random(0) gives white noise.
const DEFS: Def[] = [
  {name: 'beep', src: "aevalsrc='0.5*sin(2*PI*1250*t)*exp(-t*25)'", d: 0.12},
  {name: 'beep-low', src: "aevalsrc='0.5*sin(2*PI*620*t)*exp(-t*18)'", d: 0.16},
  {name: 'blip', src: "aevalsrc='0.25*sgn(sin(2*PI*880*t))*exp(-t*60)'", d: 0.05},
  {name: 'tick', src: "aevalsrc='0.6*(random(0)*2-1)*exp(-t*300)'", d: 0.03, af: 'highpass=f=2500'},
  {name: 'type', src: "aevalsrc='0.5*(random(0)*2-1)*exp(-t*180)+0.2*sin(2*PI*2400*t)*exp(-t*120)'", d: 0.05, af: 'highpass=f=1200'},
  {name: 'stamp', src: "aevalsrc='0.9*sin(2*PI*(70-40*t)*t)*exp(-t*9)+0.5*(random(0)*2-1)*exp(-t*40)'", d: 0.45, af: 'lowpass=f=2500'},
  {name: 'boom', src: "aevalsrc='0.9*sin(2*PI*(48-20*t)*t)*exp(-t*2.2)+0.35*(random(0)*2-1)*exp(-t*3)'", d: 1.6, af: 'lowpass=f=900'},
  {name: 'glitch', src: "aevalsrc='0.35*sgn(sin(2*PI*(300+900*gt(sin(2*PI*37*t),0))*t))*gt(sin(2*PI*23*t),-0.3)+0.25*(random(0)*2-1)*gt(sin(2*PI*11*t),0.4)'", d: 0.35, af: 'acrusher=bits=6:samples=6'},
  {name: 'pixel', src: "aevalsrc='0.22*sgn(sin(2*PI*(500+1500*floor(mod(t*40,7))/7)*t))*exp(-t*6)'", d: 0.32},
  {name: 'whoosh', src: 'anoisesrc=color=pink:amplitude=0.8', d: 0.7, af: "bandpass=f=1200:w=900,volume='sin(PI*t/0.7)':eval=frame,volume=46dB"},
  {name: 'counter', src: "aevalsrc='0.3*sin(2*PI*1800*t)*lt(mod(t,0.06),0.012)'", d: 1.2},
  {name: 'heartbeat', src: "aevalsrc='0.9*sin(2*PI*55*t)*(exp(-mod(t,1)*28)*lt(mod(t,1),0.2)+0.7*exp(-(mod(t,1)-0.28)*28)*gt(mod(t,1),0.28)*lt(mod(t,1),0.5))'", d: 1.0, af: 'lowpass=f=300'},
  {name: 'alarm', src: "aevalsrc='0.35*sin(2*PI*(gt(mod(t,0.5),0.25)*300+700)*t)'", d: 1.5},
  {name: 'sting', src: "aevalsrc='0.35*(sin(2*PI*880*t)+0.6*sin(2*PI*1320*t)+0.3*sin(2*PI*1760*t))*exp(-t*2.5)'", d: 1.6},
  {name: 'swell', src: "aevalsrc='0.4*(sin(2*PI*110*t)+0.5*sin(2*PI*165*t)+0.3*sin(2*PI*220*t))*t/1.8'", d: 1.8, af: 'lowpass=f=1200'},
  {name: 'splash', src: 'anoisesrc=color=white:amplitude=0.9', d: 0.9, af: "lowpass=f=2200,volume='exp(-t*4)':eval=frame"},
  {name: 'thunder', src: 'anoisesrc=color=brown:amplitude=1', d: 2.5, af: "lowpass=f=300,volume='min(1,t*6)*exp(-t*1.4)':eval=frame,volume=2.5"},
  {name: 'pop', src: "aevalsrc='0.6*sin(2*PI*(300+5000*t)*t)*exp(-t*35)'", d: 0.12},
  {name: 'ding', src: "aevalsrc='0.4*(sin(2*PI*1568*t)+0.5*sin(2*PI*2352*t)+0.25*sin(2*PI*3136*t))*exp(-t*3.5)'", d: 1.2},
  {name: 'cash', src: "aevalsrc='0.5*(random(0)*2-1)*exp(-t*40)+0.35*(sin(2*PI*2093*t)+0.6*sin(2*PI*2637*t))*exp(-(t-0.08)*5)*gt(t,0.08)'", d: 0.9},
  // ambiences: one continuous 100 s take (no loop seam, no fade inside the video)
  {name: 'amb-rain', src: 'anoisesrc=color=pink:amplitude=0.5', d: 100, af: 'highpass=f=500,lowpass=f=5000'},
  {name: 'amb-storm', src: 'anoisesrc=color=pink:amplitude=0.6', d: 100, af: "highpass=f=300,lowpass=f=4000,volume='0.8+0.2*sin(2*PI*t/5)':eval=frame"},
  {name: 'amb-underwater', src: 'anoisesrc=color=brown:amplitude=0.8', d: 100, af: "lowpass=f=350,volume='0.7+0.3*sin(2*PI*t/4)':eval=frame"},
  {name: 'amb-drone', src: "aevalsrc='0.25*sin(2*PI*55*t)+0.18*sin(2*PI*82.4*t)*(0.6+0.4*sin(2*PI*t/10))+0.08*sin(2*PI*110.3*t)'", d: 100, af: 'lowpass=f=600'},
  {name: 'amb-wind', src: 'anoisesrc=color=pink:amplitude=0.6', d: 100, af: "bandpass=f=700:w=500,volume='0.5+0.5*sin(2*PI*t/6.6)':eval=frame"},
  {name: 'amb-jungle', src: "aevalsrc='0.06*sin(2*PI*4700*t)*gt(sin(2*PI*14*t),0.3)*gt(sin(2*PI*0.5*t),-0.2)+0.04*sin(2*PI*3900*t)*gt(sin(2*PI*11*t+1),0.5)'", d: 100},
  {name: 'amb-room', src: 'anoisesrc=color=brown:amplitude=0.3', d: 100, af: 'lowpass=f=200'},
  {name: 'amb-tension', src: "aevalsrc='0.2*sin(2*PI*41.2*t)+0.12*sin(2*PI*43.6*t)+0.05*sin(2*PI*329.6*t)*(0.5+0.5*sin(2*PI*t/7))'", d: 100, af: 'lowpass=f=800'},
];

for (const def of DEFS) {
  const ext = def.mp3 ? 'mp3' : 'wav';
  const file = path.join(OUT, `${def.name}.${ext}`);
  const filters = [def.af, 'alimiter=limit=0.89:level=false', `afade=t=in:d=0.004`, def.mp3 ? `afade=t=out:st=${def.d - 0.5}:d=0.5` : `afade=t=out:st=${Math.max(0, def.d - 0.02)}:d=0.02`]
    .filter(Boolean)
    .join(',');
  const input = def.src.startsWith('anoisesrc=') ? def.src.replace('anoisesrc=', `anoisesrc=d=${def.d}:`) : `${def.src}:d=${def.d}`;
  const args = ['-v', 'error', '-y', '-f', 'lavfi', '-i', input, '-af', filters, '-ar', '44100', '-ac', '1'];
  if (def.mp3) args.push('-b:a', '128k');
  args.push(file);
  execFileSync('ffmpeg', args);
  console.log('sfx', path.basename(file));
}
