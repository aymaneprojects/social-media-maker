// One command, one video:
//   npm run make -- --brand histoires-vraies [--topic "..."] [--storyboard file.json] [--no-render]
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {credits} from '../core/openrouter';
import {alignWords, synthesize} from '../core/voice';
import {assembleEpisode, makeAssetsB, makeImages, stripImages, validateStoryboard} from './assemble';
import {loadBrand, loadHistory, nextIssue, saveHistory} from './brands';
import {renderEpisode} from './render';
import {loadAgent, markDone, sameTopic} from './agents';
import {direct, factCheck, pickTopic, research, type Facts, type Storyboard, type TopicPick} from './steps';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

// angle and subgenre of a topic imposed by hand, when the page's agent has it in its backlog
const backlogMeta = (slug: string, topic: string) => {
  const b = loadAgent(slug).backlog.find((x) => sameTopic(x.topic, topic));
  return b ? {angle: b.angle, hook: b.hook, subgenre: b.subgenre} : {};
};

export const makeVideo = async (opts: {brand: string; topic?: string; storyboard?: string; render?: boolean}) => {
  const brand = loadBrand(opts.brand);
  let history = loadHistory();
  // re-rendering a video that was not published yet keeps its issue number
  const again = opts.topic ? history.find((h) => h.brand === brand.slug && h.topic === opts.topic && h.status === 'rendered') : undefined;
  if (again) history = history.filter((h) => h !== again);
  const issue = again?.issue ?? nextIssue(history, brand.slug);
  try {
    console.log(`OpenRouter balance: $${(await credits()).toFixed(2)}`);
  } catch {
    /* informative only */
  }

  let sb: Storyboard;
  let facts: Facts | undefined;
  let topic = opts.topic ?? '';
  let pick: TopicPick | undefined;
  if (opts.storyboard) {
    sb = JSON.parse(readFileSync(opts.storyboard, 'utf8'));
    topic = topic || sb.title;
    pick = {topic, ...backlogMeta(brand.slug, topic)};
  } else {
    pick = topic ? {topic, ...backlogMeta(brand.slug, topic)} : await pickTopic(brand, history);
    topic = pick.topic;
    console.log(`topic: ${topic}`);
    facts = await research(topic, brand, pick.angle);
    sb = await direct(brand, facts, issue, validateStoryboard(brand.style), pick);
    const check = await factCheck(facts, sb);
    for (const f of check.fixes ?? []) {
      if (sb.beats[f.beat]) {
        console.log(`fact fix beat ${f.beat}: "${sb.beats[f.beat].text}" -> "${f.text}" (${f.reason})`);
        sb.beats[f.beat].text = f.text;
      }
    }
  }
  const errors = validateStoryboard(brand.style)(sb);
  if (errors.length) console.warn('storyboard warnings:\n- ' + errors.join('\n- '));

  const date = new Date().toISOString().slice(0, 10);
  const id = `${brand.slug}-${String(issue).padStart(3, '0')}-${slugify(topic)}`;
  const dir = path.join('public', 'ep', id);
  mkdirSync(dir, {recursive: true});
  if (facts) writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 2));
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb, null, 2));

  const script = sb.beats.map((b) => b.text.trim()).join(' ');
  const voice = path.join(dir, 'voice.mp3');
  // the voice is reused only if it was recorded for exactly this script
  const voiceScript = path.join(dir, 'voice-script.txt');
  const sameScript = existsSync(voiceScript) && readFileSync(voiceScript, 'utf8') === script;
  if (!existsSync(voice) || !sameScript) {
    const ms = await synthesize(script, voice, {voice: brand.voice});
    writeFileSync(voiceScript, script);
    console.log(`voice: ${(ms / 1000).toFixed(1)}s`);
  }
  const words = await alignWords(voice, script, dir);
  // guard: what the voice actually says must match the script (catches a stale or wrong recording)
  try {
    const asr = (JSON.parse(readFileSync(path.join(dir, 'words.json'), 'utf8')).asr ?? []) as {text: string}[];
    const toks = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
    const said = toks(asr.map((w) => w.text).join(' '));
    const want = toks(script);
    const bag = new Map<string, number>();
    for (const t of said) bag.set(t, (bag.get(t) ?? 0) + 1);
    let common = 0;
    for (const t of want) if ((bag.get(t) ?? 0) > 0) (common++, bag.set(t, bag.get(t)! - 1));
    const match = common / Math.max(1, want.length);
    console.log(`voice/script match: ${(match * 100).toFixed(0)} %`);
    if (asr.length && match < 0.7) throw new Error(`the voice does not match the script (${(match * 100).toFixed(0)} %): delete ${voice} and run again`);
  } catch (e) {
    if ((e as Error).message.startsWith('the voice')) throw e;
  }
  // style A: AI images only if the page allows them (default: 100 % code); style B: illustrations are mandatory
  let assets;
  if (brand.style === 'B') assets = await makeAssetsB(sb, dir);
  else if (brand.aiImages === false) stripImages(sb);
  else await makeImages(brand.style, brand, sb, dir);
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb, null, 2));

  const music = brand.style === 'B' && existsSync('public/music/bed-b.mp3') ? 'music/bed-b.mp3' : undefined;
  const ep = assembleEpisode({id, brand, issue, sb, words, assetsBase: `ep/${id}/`, music, assets});
  const epFile = path.join(dir, 'episode.json');
  writeFileSync(epFile, JSON.stringify(ep, null, 1));
  writeFileSync(path.join(dir, 'post.json'), JSON.stringify({...sb.post, brand: brand.slug, issue, title: sb.title}, null, 2));
  console.log(`episode: ${epFile} (${(ep.durationMs / 1000).toFixed(1)}s, ${ep.beats.length} beats)`);

  if (opts.render === false) return {epFile};
  const outDir = path.join('out', brand.slug, `${date}-${String(issue).padStart(3, '0')}-${slugify(topic)}`);
  const {final, qa} = await renderEpisode(epFile, outDir);
  copyFileSync(path.join(dir, 'post.json'), path.join(outDir, 'post.json'));
  copyFileSync(epFile, path.join(outDir, 'episode.json'));
  const scenes: Record<string, number> = {};
  for (const b of sb.beats) scenes[b.scene.type] = (scenes[b.scene.type] ?? 0) + 1;
  history.push({
    brand: brand.slug,
    issue,
    topic,
    title: sb.title,
    episodeId: id,
    createdAt: new Date().toISOString(),
    final,
    status: 'rendered',
    subgenre: pick?.subgenre,
    angle: pick?.angle,
    hook: sb.beats[0]?.text,
    durationMs: ep.durationMs,
    scenes,
  });
  saveHistory(history);
  markDone(brand.slug, topic, id);
  console.log(JSON.stringify(qa, null, 2));
  return {epFile, final, qa};
};

if (process.argv[1]?.endsWith('make.ts')) {
  const brand = arg('brand');
  if (!brand) {
    console.error('usage: npm run make -- --brand <slug> [--topic "..."] [--storyboard file.json] [--no-render]');
    process.exit(1);
  }
  makeVideo({brand, topic: arg('topic'), storyboard: arg('storyboard'), render: !flag('no-render')}).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
