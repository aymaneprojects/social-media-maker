// LLM steps: topic, research, storyboard (style-specific director), fact check.
import {readFileSync} from 'node:fs';
import {chat, chatJson, MODELS} from '../core/openrouter';
import type {AssetSpec} from '../core/illustrate';
import type {BrandConfig, HistoryEntry} from './brands';

export type Facts = {
  topic: string;
  summary: string | string[];
  timeline: {date: string; event: string}[];
  people: {name: string; age?: string; role?: string}[];
  places: {name: string; country?: string; lon?: number; lat?: number}[];
  numbers: {label: string; value: string}[];
  twist: string;
  ending: string;
  uncertain: string[];
  sources: string[];
};

export type StoryBeat = {
  text: string;
  scene: {type: string; [k: string]: unknown};
  hud?: Record<string, unknown>;
  transition?: string;
  annotation?: string;
  keyword?: string;
  sfx?: string[];
  imagePrompt?: string;
};

export type Storyboard = {
  title: string;
  endCard: {place: string; year: string};
  post: {caption: string; hashtags: string[]; youtubeTitle: string; description: string};
  ambience?: {sound: string; fromBeat: number; toBeat: number; volume?: number}[];
  music?: {mood: string};
  assets?: AssetSpec[]; // style B illustrations
  beats: StoryBeat[];
};

const today = () => new Date().toISOString().slice(0, 10);

export const pickTopic = async (brand: BrandConfig, history: HistoryEntry[]): Promise<string> => {
  const done = history.filter((h) => h.brand === brand.slug).map((h) => h.topic);
  const {data} = await chatJson<{topics: {topic: string; hook: string}[]}>({
    model: MODELS.writer,
    temperature: 0.9,
    messages: [
      {
        role: 'system',
        content:
          'Tu es rédacteur en chef d\'une page de vidéos courtes. Tu proposes des sujets VRAIS, documentés, peu connus du grand public ou racontables sous un angle inattendu, très visuels, avec des chiffres forts et un retournement. Réponds uniquement en JSON.',
      },
      {
        role: 'user',
        content: `Thème de la page : ${brand.theme}
Exemples du ton recherché : ${brand.examples.join(' ; ')}
Déjà traités (à exclure, ainsi que les sujets trop proches) : ${done.join(' ; ') || 'aucun'}
Date du jour : ${today()} (si un anniversaire tombe cette semaine, propose-le en premier).
Propose 8 sujets, du meilleur au moins bon : {"topics":[{"topic":"sujet précis (personne/lieu/année)","hook":"accroche en une phrase"}]}`,
      },
    ],
  });
  const pick = data.topics.find((t) => !done.some((d) => d.toLowerCase() === t.topic.toLowerCase()));
  if (!pick) throw new Error('no new topic proposed');
  return pick.topic;
};

export const research = async (topic: string): Promise<Facts> => {
  const {data, citations} = await chatJson<Facts>({
    model: MODELS.research,
    web: true,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Tu es documentaliste. Tu vérifies chaque fait sur des sources fiables (encyclopédies, presse reconnue, rapports officiels). Tu signales ce qui est incertain ou contesté. Réponds uniquement en JSON.',
      },
      {
        role: 'user',
        content: `Sujet : ${topic}
Construis la fiche factuelle d'une vidéo de 1 à 2 minutes :
{"topic":"","summary":"5 phrases","timeline":[{"date":"JJ.MM.AAAA ou heure","event":""}],"people":[{"name":"","age":"","role":""}],"places":[{"name":"","country":"(nom anglais Natural Earth)","lon":0,"lat":0}],"numbers":[{"label":"","value":""}],"twist":"le retournement","ending":"ce qui se passe après / bilan","uncertain":["points incertains ou versions divergentes"],"sources":["url"]}`,
      },
    ],
  });
  data.sources = Array.from(new Set([...(data.sources ?? []), ...citations.map((c) => c.url)]));
  return data;
};

export const direct = async (brand: BrandConfig, facts: Facts, issue: number, validate: (sb: Storyboard) => string[]): Promise<Storyboard> => {
  const director = readFileSync(`src/styles/${brand.style === 'A' ? 'A-hud' : 'B-gold'}/director.md`, 'utf8');
  const messages = [
    {role: 'system' as const, content: director},
    {
      role: 'user' as const,
      content: `Page : ${brand.name} (${brand.handle}) — ${brand.theme}
Épisode n°${issue}. Date du jour : ${today()}.
${brand.aiImages === false ? "IMAGES IA DÉSACTIVÉES pour cette page : n'utilise jamais la scène `image` ni le champ `imagePrompt`. Tout est dessiné par le code (backdrop, map, dossier, portrait, gauge, counter…).\n" : ''}Dossier de recherche (seule source autorisée) :
${JSON.stringify(facts, null, 1)}`,
    },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    const {text} = await chat({model: MODELS.writer, messages, temperature: 0.8, maxTokens: 16000});
    try {
      const sb = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Storyboard;
      const errors = validate(sb);
      if (!errors.length) return sb;
      console.warn(`storyboard attempt ${attempt + 1}: ${errors.length} problem(s)\n- ${errors.slice(0, 8).join('\n- ')}`);
      messages.push({role: 'assistant' as const, content: text} as never);
      messages.push({role: 'user' as const, content: `Corrige ces problèmes et renvoie le JSON complet :\n- ${errors.join('\n- ')}`});
    } catch (e) {
      console.warn(`storyboard attempt ${attempt + 1}: invalid JSON (${(e as Error).message.slice(0, 120)})`);
      messages.push({role: 'assistant' as const, content: text} as never);
      messages.push({role: 'user' as const, content: `JSON invalide (${(e as Error).message}). Renvoie uniquement le JSON complet et valide.`});
    }
  }
  throw new Error('storyboard still invalid after 3 attempts');
};

export const factCheck = async (facts: Facts, sb: Storyboard): Promise<{ok: boolean; fixes: {beat: number; text: string; reason: string}[]}> => {
  const {data} = await chatJson<{ok: boolean; fixes: {beat: number; text: string; reason: string}[]}>({
    model: MODELS.research,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Tu es vérificateur. Compare chaque phrase de la voix off au dossier factuel. Signale toute affirmation fausse, exagérée ou absente du dossier, et propose une correction de même longueur. Ne touche pas au style. Réponds en JSON.',
      },
      {
        role: 'user',
        content: `Dossier : ${JSON.stringify(facts)}
Voix off (index: texte) :
${sb.beats.map((b, i) => `${i}: ${b.text}`).join('\n')}
Réponds : {"ok":true|false,"fixes":[{"beat":index,"text":"texte corrigé","reason":"pourquoi"}]}`,
      },
    ],
  });
  return data;
};
