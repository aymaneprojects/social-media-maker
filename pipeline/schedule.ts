// Schedules rendered videos on the brand's fixed slots through Upload-Post.
//   npx tsx pipeline/schedule.ts --brand histoires-vraies [--dry]      (next rendered video)
//   npx tsx pipeline/schedule.ts --status                              (refresh job statuses)
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {uploadStatus, uploadVideo} from '../core/uploadpost';
import {loadBrand, loadHistory, saveHistory, type BrandConfig, type HistoryEntry} from './brands';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Wall-clock time in a timezone -> ISO string with offset (e.g. 2026-10-19T18:30:00+02:00).
const zonedIso = (y: number, m: number, d: number, hh: number, mm: number, tz: string) => {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
    .formatToParts(new Date(guess))
    .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offsetMin = (asUtc - guess) / 60000;
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

// Next free slot for a brand, at least `minLeadMin` minutes from now.
export const nextSlot = (brand: BrandConfig, history: HistoryEntry[], minLeadMin = 60) => {
  const taken = new Set(history.filter((h) => h.brand === brand.slug && h.scheduledFor).map((h) => h.scheduledFor!.slice(0, 16)));
  const tz = brand.schedule.timezone;
  const now = Date.now();
  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const day = new Date(now + dayOffset * 86400000);
    const p = new Intl.DateTimeFormat('en-US', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'})
      .formatToParts(day)
      .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
    const wd = p.weekday.toLowerCase().slice(0, 3);
    if (!brand.schedule.days.includes(wd) && !brand.schedule.days.includes(DAYS[day.getUTCDay()])) continue;
    for (const slot of brand.schedule.slots) {
      const [hh, mm] = slot.split(':').map(Number);
      const iso = zonedIso(+p.year, +p.month, +p.day, hh, mm, tz);
      if (new Date(iso).getTime() < now + minLeadMin * 60000) continue;
      if (taken.has(iso.slice(0, 16))) continue;
      return iso;
    }
  }
  throw new Error('no free slot in the next 90 days');
};

export const scheduleNext = async (slug: string, dry = false) => {
  const brand = loadBrand(slug);
  if (!brand.uploadProfile) throw new Error(`brand ${slug} has no Upload-Post profile yet (brands/${slug}.json -> uploadProfile)`);
  const history = loadHistory();
  const entry = history.find((h) => h.brand === slug && h.status === 'rendered' && h.final);
  if (!entry) throw new Error(`no rendered video waiting for ${slug}`);
  const post = JSON.parse(readFileSync(path.join('public', 'ep', entry.episodeId, 'post.json'), 'utf8'));
  const when = nextSlot(brand, history);
  const hashtags = Array.from(new Set([...(post.hashtags ?? []), ...brand.hashtags])).slice(0, 8);
  console.log(`${slug}: "${entry.title}" -> ${when} on profile ${brand.uploadProfile}`);
  if (dry) return {when};
  const res = await uploadVideo({
    profile: brand.uploadProfile,
    file: entry.final!,
    meta: {caption: post.caption, youtubeTitle: post.youtubeTitle, description: post.description, hashtags},
    scheduledDate: when,
    timezone: brand.schedule.timezone,
    idempotencyKey: entry.episodeId,
  });
  entry.status = 'scheduled';
  entry.scheduledFor = when;
  entry.uploadJob = res.job_id ?? res.request_id;
  saveHistory(history);
  console.log(JSON.stringify(res));
  return res;
};

export const refreshStatuses = async () => {
  const history = loadHistory();
  for (const h of history.filter((x) => x.status === 'scheduled' && x.uploadJob)) {
    const st = await uploadStatus({job_id: h.uploadJob});
    console.log(h.episodeId, JSON.stringify(st).slice(0, 300));
    if (st.status === 'completed') h.status = 'published';
    if (st.status === 'failed') h.status = 'failed';
  }
  saveHistory(history);
};

if (process.argv[1]?.endsWith('schedule.ts')) {
  const i = process.argv.indexOf('--brand');
  const run = process.argv.includes('--status') ? refreshStatuses() : scheduleNext(process.argv[i + 1], process.argv.includes('--dry'));
  run.catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
