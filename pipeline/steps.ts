// LLM steps: topic, research, storyboard (style-specific director), fact check.
import {readFileSync} from 'node:fs';
import {chat, chatJson, extractJson, MODELS} from '../core/openrouter';
import type {AssetSpec} from '../core/illustrate';
import {agentBrief, loadAgent, sameTopic, saveBacklog, section} from './agents';
import {loadHistory, type BrandConfig, type HistoryEntry} from './brands';
import {nextSlot} from './schedule';

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

// Day the video will actually go out: next free slot, pushed back by videos already waiting.
const publishDate = (brand: BrandConfig, history: HistoryEntry[]) => {
  try {
    const queued = history.filter((h) => h.brand === brand.slug && h.status === 'rendered').length;
    const perDay = Math.max(1, brand.schedule.slots.length);
    return new Date(Date.parse(nextSlot(brand, history)) + Math.floor(queued / perDay) * 86400000).toISOString().slice(0, 10);
  } catch {
    return today();
  }
};

export type TopicPick = {topic: string; angle?: string; hook?: string; subgenre?: string};

// The page's agent picks the next topic from its backlog (and tops the backlog up),
// applying its persona and what the analytics taught it.
export const pickTopic = async (brand: BrandConfig, history: HistoryEntry[]): Promise<TopicPick> => {
  const agent = loadAgent(brand.slug);
  const done = history.filter((h) => h.brand === brand.slug);
  const doneTopics = done.map((h) => h.topic);
  const todo = agent.backlog.filter((b) => b.status === 'todo' && !doneTopics.some((d) => sameTopic(d, b.topic)));
  const want = Math.max(0, 15 - todo.length);
  const {data} = await chatJson<{pick: number; reason: string; ideas: {topic: string; angle: string; hook: string; subgenre: string}[]}>({
    model: MODELS.writer,
    temperature: 0.7,
    reasoning: 3000,
    messages: [
      {role: 'system', content: `${agentBrief(agent)}\n\nTu es le rédacteur en chef de cette page. Réponds uniquement en JSON.`},
      {
        role: 'user',
        content: `Date du jour : ${today()}. Publication prévue : ${publishDate(brand, history)} (un anniversaire marquant dans les jours autour de la publication passe en priorité).
Sous-genres des 3 dernières vidéos (à ne pas répéter) : ${done.slice(-3).map((h) => h.subgenre ?? '?').join(', ') || 'aucune vidéo'}
Déjà publiés (à exclure, ainsi que les sujets trop proches) : ${doneTopics.join(' ; ') || 'aucun'}
Backlog (index : sujet | angle | sous-genre) :
${todo.map((b, i) => `${i} : ${b.topic} | ${b.angle ?? ''} | ${b.subgenre ?? ''}`).join('\n') || '(vide)'}

1) Choisis LE sujet du backlog le plus fort pour la prochaine vidéo, en appliquant ta mémoire et la rotation des sous-genres (pick = index, -1 si le backlog est vide).
2) Propose ${want} nouvelles idées pour le backlog : vraies, documentées, très visuelles, avec un chiffre fort et un retournement, différentes des sujets existants.
{"pick":0,"reason":"pourquoi","ideas":[{"topic":"sujet précis (personne/lieu/année)","angle":"l'angle en une phrase","hook":"première phrase de la voix off","subgenre":"un sous-genre de ta liste"}]}`,
      },
    ],
  });
  const fresh = (data.ideas ?? []).filter((i) => i.topic && ![...agent.backlog.map((b) => b.topic), ...doneTopics].some((t) => sameTopic(t, i.topic)));
  agent.backlog.push(...fresh.map((i) => ({...i, status: 'todo' as const, by: 'agent' as const})));
  saveBacklog(brand.slug, agent.backlog);
  const chosen = todo[data.pick] ?? todo[0] ?? fresh[0];
  if (!chosen) throw new Error('no topic available');
  console.log(`agent pick: ${chosen.topic} (${data.reason ?? ''})`);
  return {topic: chosen.topic, angle: chosen.angle, hook: chosen.hook, subgenre: chosen.subgenre};
};

export const research = async (topic: string, brand?: BrandConfig, angle?: string): Promise<Facts> => {
  const persona = brand ? loadAgent(brand.slug).persona : '';
  const {data, citations} = await chatJson<Facts>({
    model: MODELS.research,
    web: true,
    temperature: 0.2,
    maxTokens: 12000,
    reasoning: 3000,
    messages: [
      {
        role: 'system',
        content: `Tu es documentaliste. Tu vérifies chaque fait sur des sources fiables (encyclopédies, presse reconnue, rapports officiels). Tu signales ce qui est incertain ou contesté. Réponds uniquement en JSON.${
          persona ? `\n\n${section(persona, 'Sources fiables')}\n\n${section(persona, 'Garde-fous')}` : ''
        }`,
      },
      {
        role: 'user',
        content: `Sujet : ${topic}${angle ? `\nAngle prévu : ${angle} (cherche en priorité les faits, chiffres et détails qui servent cet angle)` : ''}
Construis la fiche factuelle d'une vidéo de 1 à 2 minutes :
{"topic":"","summary":"5 phrases","timeline":[{"date":"JJ.MM.AAAA ou heure","event":""}],"people":[{"name":"","age":"","role":""}],"places":[{"name":"","country":"(nom anglais Natural Earth)","lon":0,"lat":0}],"numbers":[{"label":"","value":""}],"twist":"le retournement","ending":"ce qui se passe après / bilan","uncertain":["points incertains ou versions divergentes"],"sources":["url"]}`,
      },
    ],
  });
  data.sources = Array.from(new Set([...(data.sources ?? []), ...citations.map((c) => c.url)]));
  return data;
};

export const direct = async (brand: BrandConfig, facts: Facts, issue: number, validate: (sb: Storyboard) => string[], pick?: TopicPick): Promise<Storyboard> => {
  const agent = loadAgent(brand.slug);
  const director = readFileSync(`src/styles/${brand.style === 'A' ? 'A-hud' : 'B-gold'}/director.md`, 'utf8');
  const messages = [
    {role: 'system' as const, content: director},
    {
      role: 'user' as const,
      content: `Page : ${brand.name} (${brand.handle}) — ${brand.theme}
Épisode n°${issue}. Date du jour : ${today()}. Publication prévue : ${publishDate(brand, loadHistory())} — n'écris « jour pour jour » ou « cette semaine » que si c'est vrai à cette date.
${agent.persona ? `\nTu écris pour l'agent éditorial de la page. Sa ligne, ses accroches, sa mise en scène et sa mémoire passent avant tes habitudes :\n<agent>\n${agentBrief(agent)}\n</agent>\n` : ''}${pick?.angle ? `Angle choisi : ${pick.angle}\n` : ''}${pick?.hook ? `Piste d'accroche (à améliorer si tu trouves plus fort dans le dossier) : ${pick.hook}\n` : ''}
${brand.aiImages === false ? "IMAGES IA DÉSACTIVÉES pour cette page : n'utilise jamais la scène `image` ni le champ `imagePrompt`. Tout est dessiné par le code (backdrop, map, dossier, portrait, gauge, counter…).\n" : ''}Dossier de recherche (seule source autorisée) :
${JSON.stringify(facts, null, 1)}`,
    },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    const {text} = await chat({model: MODELS.writer, messages, temperature: 0.8, maxTokens: 20000, reasoning: 6000});
    try {
      const sb = (await parseOrRepair(text)) as Storyboard;
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

// Parse the model's JSON; on a syntax slip (unescaped quote…) ask for a cheap repair instead of a full rewrite.
const parseOrRepair = async (text: string): Promise<unknown> => {
  try {
    return extractJson(text);
  } catch (e) {
    console.warn(`invalid JSON (${(e as Error).message.slice(0, 100)}), repairing`);
    const fixed = await chat({
      model: MODELS.writer,
      temperature: 0,
      maxTokens: 12000,
      messages: [
        {role: 'system', content: 'Tu répares du JSON invalide. Renvoie uniquement le JSON corrigé, sans rien changer au contenu (échappe les guillemets internes, ajoute les virgules manquantes).'},
        {role: 'user', content: `Erreur : ${(e as Error).message}\n\n${text}`},
      ],
    });
    return extractJson(fixed.text);
  }
};

export const factCheck = async (facts: Facts, sb: Storyboard): Promise<{ok: boolean; fixes: {beat: number; text: string; reason: string}[]}> => {
  const {data} = await chatJson<{ok: boolean; fixes: {beat: number; text: string; reason: string}[]}>({
    model: MODELS.research,
    temperature: 0,
    maxTokens: 10000,
    reasoning: 3000,
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
