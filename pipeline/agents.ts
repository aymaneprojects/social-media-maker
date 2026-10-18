// Theme agents: one editorial persona per page, with a memory fed by the analytics
// loop (learnings.md) and a topic backlog. Files live in agents/<brand slug>/.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

export type BacklogItem = {
  topic: string;
  angle?: string;
  hook?: string;
  subgenre?: string;
  status: 'todo' | 'done' | 'skipped';
  by?: 'seed' | 'agent' | 'user';
  episodeId?: string;
};

export type Agent = {slug: string; persona: string; learnings: string; backlog: BacklogItem[]};

const dir = (slug: string) => `agents/${slug}`;
const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

export const loadAgent = (slug: string): Agent => {
  const backlogFile = `${dir(slug)}/backlog.json`;
  return {
    slug,
    persona: read(`${dir(slug)}/persona.md`),
    learnings: read(`${dir(slug)}/learnings.md`),
    backlog: existsSync(backlogFile) ? JSON.parse(readFileSync(backlogFile, 'utf8')) : [],
  };
};

export const saveBacklog = (slug: string, backlog: BacklogItem[]) => writeFileSync(`${dir(slug)}/backlog.json`, JSON.stringify(backlog, null, 1));

// One "## heading" section of a markdown file (heading match is a prefix, case-insensitive).
export const section = (md: string, heading: string) => {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.toLowerCase().startsWith(`## ${heading.toLowerCase()}`));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start, end < 0 ? undefined : end).join('\n').trim();
};

// Full brief injected in the editorial steps: common rules + persona + memory.
export const agentBrief = (a: Agent) =>
  [read('agents/_common.md'), a.persona, a.learnings ? `# Ta mémoire (ce que nos statistiques ont appris)\n${a.learnings}` : ''].filter(Boolean).join('\n\n---\n\n');

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const sameTopic = (a: string, b: string) => norm(a) === norm(b);

export const markDone = (slug: string, topic: string, episodeId: string) => {
  const a = loadAgent(slug);
  const item = a.backlog.find((b) => sameTopic(b.topic, topic));
  if (!item) return;
  item.status = 'done';
  item.episodeId = episodeId;
  saveBacklog(slug, a.backlog);
};
