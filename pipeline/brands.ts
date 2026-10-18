import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';

export type BrandConfig = {
  slug: string;
  name: string;
  handle: string;
  style: 'A' | 'B';
  accent: string;
  lang: string;
  theme: string;
  examples: string[];
  provisional?: boolean;
  uploadProfile: string | null;
  voice: string;
  aiImages?: boolean; // false = 100 % code-drawn visuals (no AI illustrations)
  schedule: {timezone: string; slots: string[]; days: string[]};
  hashtags: string[];
};

export const loadBrand = (slug: string): BrandConfig => JSON.parse(readFileSync(`brands/${slug}.json`, 'utf8'));

export type HistoryEntry = {
  brand: string;
  issue: number;
  topic: string;
  title: string;
  episodeId: string;
  createdAt: string;
  final?: string;
  scheduledFor?: string;
  uploadJob?: string;
  status: 'rendered' | 'scheduled' | 'published' | 'failed';
};

const HISTORY = 'data/history.json';

export const loadHistory = (): HistoryEntry[] => (existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : []);

export const saveHistory = (h: HistoryEntry[]) => {
  mkdirSync('data', {recursive: true});
  writeFileSync(HISTORY, JSON.stringify(h, null, 2));
};

export const nextIssue = (h: HistoryEntry[], brand: string) => 1 + h.filter((e) => e.brand === brand).reduce((m, e) => Math.max(m, e.issue), 0);
