// Thin OpenRouter client: chat (JSON schema + web search), images, speech,
// transcription. Every call is logged with its cost in data/costs.jsonl.
import {appendFileSync, mkdirSync} from 'node:fs';

const BASE = 'https://openrouter.ai/api/v1';

const key = () => {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error('OPENROUTER_API_KEY is not set');
  return k;
};

const headers = () => ({
  Authorization: `Bearer ${key()}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/aymaneprojects/social-media-maker',
  'X-Title': 'social-media-maker',
});

const logCost = (kind: string, model: string, usage: unknown) => {
  mkdirSync('data', {recursive: true});
  appendFileSync('data/costs.jsonl', JSON.stringify({at: new Date().toISOString(), kind, model, usage}) + '\n');
};

const post = async (path: string, body: unknown, retries = 2): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {method: 'POST', headers: headers(), body: JSON.stringify(body)});
    if (res.ok) return res;
    const text = await res.text();
    if (res.status === 402) throw new Error(`OpenRouter: insufficient credits (402). Add credits at https://openrouter.ai/settings/credits. ${text}`);
    if (attempt >= retries || (res.status < 500 && res.status !== 429)) throw new Error(`OpenRouter ${path} ${res.status}: ${text.slice(0, 600)}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
};

export const MODELS = {
  writer: process.env.OR_WRITER_MODEL ?? 'anthropic/claude-sonnet-5.5',
  research: process.env.OR_RESEARCH_MODEL ?? 'anthropic/claude-sonnet-5.5',
  image: process.env.OR_IMAGE_MODEL ?? 'google/gemini-3.1-flash-image',
  tts: process.env.OR_TTS_MODEL ?? 'elevenlabs/eleven-multilingual-v2',
  stt: process.env.OR_STT_MODEL ?? 'elevenlabs/scribe-v2',
  music: process.env.OR_MUSIC_MODEL ?? 'google/lyria-3-clip-preview',
};

export type ChatMessage = {role: 'system' | 'user' | 'assistant'; content: string};

export const chat = async (opts: {
  model?: string;
  messages: ChatMessage[];
  schema?: {name: string; schema: Record<string, unknown>};
  web?: boolean; // enable web search with citations
  temperature?: number;
  maxTokens?: number;
}): Promise<{text: string; citations: {url: string; title?: string}[]}> => {
  const model = opts.model ?? MODELS.writer;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 8000,
  };
  if (opts.schema) body.response_format = {type: 'json_schema', json_schema: {name: opts.schema.name, strict: true, schema: opts.schema.schema}};
  if (opts.web) body.plugins = [{id: 'web', max_results: 8}];
  const res = await post('/chat/completions', body);
  const json = (await res.json()) as {
    choices: {message: {content: string; annotations?: {type: string; url_citation?: {url: string; title?: string}}[]}}[];
    usage?: unknown;
  };
  logCost('chat', model, json.usage);
  const msg = json.choices[0].message;
  const citations = (msg.annotations ?? []).filter((a) => a.type === 'url_citation' && a.url_citation).map((a) => a.url_citation!);
  return {text: msg.content, citations};
};

const extractJson = (text: string) => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

export const chatJson = async <T>(opts: Parameters<typeof chat>[0]): Promise<{data: T; citations: {url: string; title?: string}[]}> => {
  const {text, citations} = await chat(opts);
  try {
    return {data: extractJson(text) as T, citations};
  } catch (e) {
    // usually an unescaped quote inside a French string: ask the model to repair its own output once
    console.warn(`invalid JSON (${(e as Error).message.slice(0, 100)}), repairing`);
    const fixed = await chat({
      model: opts.model,
      temperature: 0,
      maxTokens: opts.maxTokens,
      messages: [
        {role: 'system', content: 'Tu répares du JSON invalide. Renvoie uniquement le JSON corrigé, sans rien changer au contenu (échappe les guillemets internes, ajoute les virgules manquantes).'},
        {role: 'user', content: `Erreur : ${(e as Error).message}\n\n${text}`},
      ],
    });
    return {data: extractJson(fixed.text) as T, citations};
  }
};

// Image generation through chat completions with image output. `images` are
// sent along with the prompt (style references, or the image to edit).
export const generateImage = async (prompt: string, opts: {model?: string; aspect?: string; images?: Buffer[]} = {}): Promise<Buffer> => {
  const model = opts.model ?? MODELS.image;
  const content = opts.images?.length
    ? [
        {type: 'text', text: prompt},
        ...opts.images.map((b) => ({type: 'image_url', image_url: {url: `data:image/png;base64,${b.toString('base64')}`}})),
      ]
    : prompt;
  const res = await post('/chat/completions', {
    model,
    messages: [{role: 'user', content}],
    modalities: ['image', 'text'],
    image_config: {aspect_ratio: opts.aspect ?? '1:1'},
  });
  const json = (await res.json()) as {choices: {message: {images?: {image_url: {url: string}}[]}}[]; usage?: unknown};
  logCost('image', model, json.usage);
  const url = json.choices[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('No image returned');
  return Buffer.from(url.split(',')[1], 'base64');
};

// Text-to-speech (ElevenLabs voices through OpenRouter).
export type VoiceSettings = {speed?: number; stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean};

export const speech = async (input: string, voice: string, opts: {model?: string; settings?: VoiceSettings} = {}): Promise<Buffer> => {
  const model = opts.model ?? MODELS.tts;
  const body: Record<string, unknown> = {model, input, voice, response_format: 'mp3'};
  // ElevenLabs voice settings are forwarded by OpenRouter as provider options
  if (opts.settings) body.provider = {options: {elevenlabs: {voice_settings: opts.settings}}};
  const res = await post('/audio/speech', body);
  logCost('tts', model, {chars: input.length});
  return Buffer.from(await res.arrayBuffer());
};

// Speech-to-text with word timestamps.
export const transcribeWords = async (mp3: Buffer, opts: {model?: string; language?: string} = {}) => {
  const model = opts.model ?? MODELS.stt;
  const res = await post('/audio/transcriptions', {
    model,
    input_audio: {data: mp3.toString('base64'), format: 'mp3'},
    language: opts.language ?? 'fr',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  });
  const json = (await res.json()) as {text: string; words?: {word: string; start: number; end: number}[]; usage?: unknown};
  logCost('stt', model, json.usage);
  return json;
};

export const credits = async () => {
  const res = await fetch(`${BASE}/credits`, {headers: headers()});
  const json = (await res.json()) as {data: {total_credits: number; total_usage: number}};
  return json.data.total_credits - json.data.total_usage;
};
