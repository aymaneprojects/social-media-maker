// Daily batch: one new video per brand, QA-gated, scheduled on the brand's
// next free slot through Upload-Post. History is committed by the caller so
// topics are never repeated across sessions.
//   npm run daily [-- --brands histoires-vraies,mysteres-crimes] [--dry] [--learn]
import {readdirSync} from 'node:fs';
import {loadBrand} from './brands';
import {learn} from './learn';
import {makeVideo} from './make';
import {scheduleNext} from './schedule';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const main = async () => {
  const dry = process.argv.includes('--dry');
  const slugs = arg('brands')?.split(',') ?? readdirSync('brands').map((f) => f.replace(/\.json$/, ''));
  const report: string[] = [];
  for (const slug of slugs) {
    const brand = loadBrand(slug);
    if (!brand.uploadProfile) {
      report.push(`${slug}: skipped (no Upload-Post profile)`);
      continue;
    }
    try {
      // once a week (Monday, or --learn) the agent first updates its memory from the stats
      const monday = new Intl.DateTimeFormat('en-US', {timeZone: brand.schedule.timezone, weekday: 'short'}).format(new Date()) === 'Mon';
      if (monday || process.argv.includes('--learn')) await learn(slug, dry).catch((e) => report.push(`${slug}: learn failed (${(e as Error).message.slice(0, 200)})`));
      const res = await makeVideo({brand: slug});
      if (!res.qa || res.qa.issues.length) {
        report.push(`${slug}: QA failed (${res.qa?.issues.join('; ') ?? 'no render'}) — not scheduled`);
        continue;
      }
      const sch = await scheduleNext(slug, dry);
      report.push(`${slug}: ${res.final} -> ${'when' in sch ? sch.when : JSON.stringify(sch)}`);
    } catch (e) {
      report.push(`${slug}: ERROR ${(e as Error).message.slice(0, 300)}`);
    }
  }
  console.log('\n=== daily report ===\n' + report.join('\n'));
};

main();
