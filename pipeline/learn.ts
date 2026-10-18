// Learning loop: Upload-Post per-post stats + the user's external reports → each agent's memory.
//   npx tsx pipeline/learn.ts [--brand <slug>] [--dry]
// Run weekly. Stats are cached in data/analytics.json, reports already read in data/reports-seen.json.
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {chatJson, MODELS} from '../core/openrouter';
import {postAnalytics, uploadHistory} from '../core/uploadpost';
import {loadAgent, saveBacklog, sameTopic, section} from './agents';
import {loadBrand, loadHistory, saveHistory, type HistoryEntry} from './brands';

type Stats = {
  fetchedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  completion?: number; // TikTok full_video_watched_rate (0-1)
  avgWatch?: number; // TikTok average_time_watched (s)
  hold3s?: number; // TikTok share of viewers still watching at 3 s (0-1)
  perPlatform: Record<string, {views: number; likes: number; comments: number; shares: number}>;
};

const ANALYTICS = 'data/analytics.json';
const SEEN = 'data/reports-seen.json';
const loadJson = <T,>(file: string, fallback: T): T => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

const summarize = (platforms: Record<string, {post_metrics?: Record<string, unknown>}>): Stats => {
  const s: Stats = {fetchedAt: new Date().toISOString(), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, perPlatform: {}};
  for (const [p, d] of Object.entries(platforms)) {
    const m = d.post_metrics;
    if (!m) continue;
    const row = {views: n(m.views), likes: n(m.likes), comments: n(m.comments), shares: n(m.shares)};
    s.perPlatform[p] = row;
    s.views += row.views;
    s.likes += row.likes;
    s.comments += row.comments;
    s.shares += row.shares;
    s.saves += n(m.saves) + n(m.favorites);
    if (p === 'tiktok') {
      if (m.full_video_watched_rate !== undefined) s.completion = n(m.full_video_watched_rate);
      if (m.average_time_watched !== undefined) s.avgWatch = n(m.average_time_watched);
      const ret = (m.retention as {second: string; percentage: number}[] | undefined)?.find((r) => n(r.second) === 3);
      if (ret) s.hold3s = n(ret.percentage);
    }
  }
  return s;
};

// Scheduled jobs only get a request_id once published: look it up in the upload history.
const resolveRequestIds = async (entries: HistoryEntry[]) => {
  const missing = entries.filter((e) => !e.postId && e.uploadJob);
  if (!missing.length) return;
  for (let page = 1; page <= 5 && missing.some((e) => !e.postId); page++) {
    const {history} = await uploadHistory(page, 100);
    if (!history?.length) break;
    for (const e of missing) {
      const hit = history.find((h) => h.request_id && (h.job_id === e.uploadJob || h.request_id === e.uploadJob));
      if (hit?.request_id) e.postId = hit.request_id;
    }
  }
};

const collectStats = async (slug: string, history: HistoryEntry[]) => {
  const cache = loadJson<Record<string, Stats>>(ANALYTICS, {});
  const minAge = 48 * 3600 * 1000; // let the algorithm settle before judging a video
  const entries = history.filter(
    (h) => h.brand === slug && (h.status === 'scheduled' || h.status === 'published') && Date.now() - Date.parse(h.scheduledFor ?? h.createdAt) > minAge,
  );
  await resolveRequestIds(entries);
  for (const e of entries.filter((x) => x.postId)) {
    try {
      const res = await postAnalytics(e.postId!);
      if (res.platforms) cache[e.episodeId] = summarize(res.platforms);
      const errors = Object.entries(res.platforms ?? {}).filter(([, d]) => d.post_metrics_error);
      for (const [p, d] of errors) console.warn(`${e.episodeId} ${p}: ${d.post_metrics_error}`);
    } catch (err) {
      console.warn(`${e.episodeId}: ${(err as Error).message}`);
    }
  }
  return {entries, cache};
};

const readNewReports = (slug: string) => {
  const dir = `agents/${slug}/reports`;
  const seen = loadJson<string[]>(SEEN, []);
  const out: {file: string; text: string}[] = [];
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const file = path.join(dir, f);
    if (f.startsWith('.') || seen.includes(file)) continue;
    let text = '';
    if (/\.(md|txt|csv|json)$/i.test(f)) text = readFileSync(file, 'utf8');
    else if (/\.pdf$/i.test(f)) {
      const r = spawnSync('pdftotext', ['-layout', file, '-'], {encoding: 'utf8'});
      text = r.status === 0 ? r.stdout : '';
      if (!text) console.warn(`${file}: pdftotext unavailable or failed, skipped`);
    }
    if (text) out.push({file, text: text.slice(0, 20000)});
  }
  return out;
};

type Analysis = {
  confirmed: string[];
  hypotheses: string[];
  avoid: string[];
  reports: string[];
  journal: string;
  ideas: {topic: string; angle: string; hook: string; subgenre: string}[];
};

const bullets = (items: string[], empty: string) => (items.length ? items.map((i) => `- ${i}`).join('\n') : empty);

export const learn = async (slug: string, dry = false) => {
  const brand = loadBrand(slug);
  const agent = loadAgent(slug);
  const history = loadHistory();
  const {entries, cache} = brand.uploadProfile ? await collectStats(slug, history) : {entries: [], cache: loadJson<Record<string, Stats>>(ANALYTICS, {})};
  const reports = readNewReports(slug);
  const rows = entries
    .filter((e) => cache[e.episodeId])
    .map((e) => {
      const s = cache[e.episodeId];
      const top = Object.entries(e.scenes ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `${k}×${v}`)
        .join(' ');
      return `n°${e.issue} | ${e.topic} | ${e.subgenre ?? '?'} | « ${e.hook ?? ''} » | ${Math.round((e.durationMs ?? 0) / 1000)} s | ${top} | vues ${s.views} | likes ${s.likes} | comm ${s.comments} | partages ${s.shares} | enregistr ${s.saves} | likes/vue ${s.views ? ((100 * s.likes) / s.views).toFixed(1) : '?'} % | vue complète ${s.completion !== undefined ? (100 * s.completion).toFixed(0) + ' %' : '?'} | temps moyen ${s.avgWatch ?? '?'} s | reste à 3 s ${s.hold3s !== undefined ? (100 * s.hold3s).toFixed(0) + ' %' : '?'}`;
    });
  console.log(`${slug}: ${rows.length} video(s) with stats, ${reports.length} new report(s)`);
  if (!rows.length && !reports.length) return;

  const {data} = await chatJson<Analysis>({
    model: MODELS.writer,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Tu es l'analyste de performance de la page « ${brand.name} ». Tu transformes des chiffres et des rapports en règles d'écriture concrètes pour l'agent éditorial. Rigueur statistique : avec moins de 5 vidéos, tout reste une hypothèse ; une règle n'est « confirmée » que si elle se vérifie sur au moins 3 vidéos et s'écarte nettement de la médiane de la page. Les indicateurs qui comptent, dans l'ordre : reste à 3 s (accroche), vue complète et temps moyen (rétention), partages et enregistrements, puis likes et commentaires. Réponds uniquement en JSON.`,
      },
      {
        role: 'user',
        content: `Ligne éditoriale de l'agent :
${section(agent.persona, 'Qui tu es')}
${section(agent.persona, 'Sous-genres')}

Mémoire actuelle :
${agent.learnings}

Vidéos publiées (n° | sujet | sous-genre | accroche | durée | scènes | stats) :
${rows.join('\n') || '(aucune statistique encore)'}

Nouveaux rapports d'autres pages (fournis par le propriétaire) :
${reports.map((r) => `### ${path.basename(r.file)}\n${r.text}`).join('\n\n') || '(aucun)'}

Mets à jour la mémoire. Garde les règles encore valables, retire celles que les chiffres contredisent, formule chaque règle comme une consigne applicable (« Ouvrir sur… », « Éviter… »), avec le chiffre qui la justifie entre parenthèses. Propose aussi jusqu'à 5 sujets dans la veine de ce qui marche.
{"confirmed":["règle (preuve chiffrée)"],"hypotheses":["…"],"avoid":["…"],"reports":["enseignement tiré des rapports, avec sa source"],"journal":"une ligne : ce qui a changé dans cette analyse","ideas":[{"topic":"","angle":"","hook":"","subgenre":""}]}`,
      },
    ],
  });

  const today = new Date().toISOString().slice(0, 10);
  const journal = section(agent.learnings, 'Journal des analyses').replace(/^## Journal des analyses\s*/, '');
  const md = `# Mémoire de l'agent — ${brand.name}
_Fichier mis à jour par \`pipeline/learn.ts\` à partir des statistiques Upload-Post et des rapports déposés dans \`reports/\`. Les règles « confirmées » priment sur les hypothèses._

## Confirmé par nos statistiques
${bullets(data.confirmed ?? [], '(pas encore assez de données)')}

## Hypothèses de départ (à tester)
${bullets(data.hypotheses ?? [], '(aucune)')}

## À éviter
${bullets(data.avoid ?? [], '(rien pour l\'instant)')}

## Rapports externes
${bullets(data.reports ?? [], '(aucun rapport déposé)')}

## Journal des analyses
${journal ? journal + '\n' : ''}- ${today} : ${rows.length} vidéo(s) analysée(s), ${reports.length} rapport(s). ${data.journal ?? ''}
`;
  if (dry) {
    console.log(md);
    return;
  }
  writeFileSync(`agents/${slug}/learnings.md`, md);
  writeFileSync(ANALYTICS, JSON.stringify(cache, null, 1));
  writeFileSync(SEEN, JSON.stringify([...loadJson<string[]>(SEEN, []), ...reports.map((r) => r.file)], null, 1));
  saveHistory(history); // persists resolved request ids
  const fresh = (data.ideas ?? []).filter((i) => i.topic && !agent.backlog.some((b) => sameTopic(b.topic, i.topic)));
  agent.backlog.push(...fresh.map((i) => ({...i, status: 'todo' as const, by: 'agent' as const})));
  saveBacklog(slug, agent.backlog);
  console.log(`${slug}: learnings updated, ${fresh.length} idea(s) added`);
};

if (process.argv[1]?.endsWith('learn.ts')) {
  const i = process.argv.indexOf('--brand');
  const slugs = i > 0 ? [process.argv[i + 1]] : readdirSync('brands').map((f) => f.replace(/\.json$/, ''));
  (async () => {
    for (const s of slugs) await learn(s, process.argv.includes('--dry'));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
