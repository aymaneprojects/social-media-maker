// Upload-Post client: scheduled multi-platform video posts + profiles.
import {readFileSync} from 'node:fs';
import path from 'node:path';

const BASE = 'https://api.upload-post.com';

const auth = () => {
  const k = process.env.UPLOAD_POST_API_KEY;
  if (!k) throw new Error('UPLOAD_POST_API_KEY is not set');
  return {Authorization: `Apikey ${k}`};
};

const json = async (res: Response) => {
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload-Post ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
};

export type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube';

export const listProfiles = async () => json(await fetch(`${BASE}/api/uploadposts/users`, {headers: auth()}));

export const createProfile = async (username: string) =>
  json(await fetch(`${BASE}/api/uploadposts/users`, {method: 'POST', headers: {...auth(), 'Content-Type': 'application/json'}, body: JSON.stringify({username})}));

// Link for the account owner to connect the social networks of a profile (valid 48 h).
export const connectLink = async (username: string, platforms: Platform[] = ['tiktok', 'instagram', 'facebook', 'youtube']) =>
  json(
    await fetch(`${BASE}/api/uploadposts/users/generate-jwt`, {
      method: 'POST',
      headers: {...auth(), 'Content-Type': 'application/json'},
      body: JSON.stringify({username, platforms}),
    }),
  );

export type PostMeta = {
  caption: string; // TikTok / Instagram caption (with hashtags)
  youtubeTitle: string;
  description: string; // Facebook / YouTube description
  hashtags: string[];
};

export const uploadVideo = async (opts: {
  profile: string;
  file: string;
  meta: PostMeta;
  platforms?: Platform[];
  scheduledDate?: string; // ISO 8601
  timezone?: string;
  idempotencyKey: string;
  facebookPageId?: string;
}) => {
  const platforms = opts.platforms ?? ['tiktok', 'instagram', 'facebook', 'youtube'];
  const tags = opts.meta.hashtags.map((h) => h.replace(/^#/, ''));
  const caption = `${opts.meta.caption}\n\n${opts.meta.hashtags.join(' ')}`.trim();
  const form = new FormData();
  form.append('user', opts.profile);
  platforms.forEach((p) => form.append('platform[]', p));
  form.append('video', new Blob([readFileSync(opts.file)], {type: 'video/mp4'}), path.basename(opts.file));
  form.append('title', caption);
  form.append('youtube_title', opts.meta.youtubeTitle.slice(0, 100));
  form.append('description', `${opts.meta.description}\n\n${opts.meta.hashtags.join(' ')}`);
  form.append('async_upload', 'true');
  // TikTok
  form.append('privacy_level', 'PUBLIC_TO_EVERYONE');
  // Instagram / Facebook
  form.append('media_type', 'REELS');
  form.append('facebook_media_type', 'REELS');
  if (opts.facebookPageId) form.append('facebook_page_id', opts.facebookPageId);
  // YouTube
  form.append('privacyStatus', 'public');
  form.append('containsSyntheticMedia', 'true');
  form.append('selfDeclaredMadeForKids', 'false');
  tags.forEach((t) => form.append('tags[]', t));
  if (opts.scheduledDate) {
    form.append('scheduled_date', opts.scheduledDate);
    form.append('timezone', opts.timezone ?? 'Europe/Paris');
  }
  const res = await fetch(`${BASE}/api/upload`, {method: 'POST', headers: {...auth(), 'Idempotency-Key': opts.idempotencyKey}, body: form});
  return json(res) as Promise<{success?: boolean; request_id?: string; job_id?: string; scheduled_date?: string; results?: unknown}>;
};

export const uploadStatus = async (id: {request_id?: string; job_id?: string}) => {
  const q = id.job_id ? `job_id=${encodeURIComponent(id.job_id)}` : `request_id=${encodeURIComponent(id.request_id ?? '')}`;
  return json(await fetch(`${BASE}/api/uploadposts/status?${q}`, {headers: auth()}));
};

// Past uploads (most recent first): maps scheduled job_id → request_id / platform post ids.
export const uploadHistory = async (page = 1, limit = 100) =>
  json(await fetch(`${BASE}/api/uploadposts/history?page=${page}&limit=${limit}`, {headers: auth()})) as Promise<{
    history: {profile_username: string; platform: string; success: boolean; platform_post_id?: string | null; post_url?: string | null; job_id?: string | null; request_id?: string | null; upload_timestamp?: string}[];
    total?: number;
  }>;

// Live per-post metrics for every platform of one upload (TikTok adds watch time and the retention curve).
export const postAnalytics = async (requestId: string) =>
  json(await fetch(`${BASE}/api/uploadposts/post-analytics/${encodeURIComponent(requestId)}`, {headers: auth()})) as Promise<{
    platforms?: Record<string, {success?: boolean; post_url?: string; post_metrics?: Record<string, unknown>; post_metrics_error?: string}>;
  }>;
