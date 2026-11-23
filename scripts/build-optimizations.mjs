#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pinyin } from 'pinyin-pro';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public/data');
const SHARD_DIR = path.join(DATA, 'text_shards');
const SHARD_COUNT = 24;

fs.mkdirSync(SHARD_DIR, { recursive: true });

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const core = readJson(path.join(DATA, 'events_core.json'));
const past = readJson(path.join(DATA, 'events_past.json'));
const pics = readJson(path.join(DATA, 'pictures.json'));
const zh = readJson(path.join(DATA, 'zh_i18n.json'));
const manifest = readJson(path.join(DATA, 'manifest.json'));

// Load text entries either from monoliths or from existing shards (idempotent)
let allText = {};
const t1Path = path.join(DATA, 'events_text.json');
const t2Path = path.join(DATA, 'events_text_2.json');
if (fs.existsSync(t1Path)) {
  const t1 = readJson(t1Path);
  Object.assign(allText, t1.events || t1);
  if (fs.existsSync(t2Path)) {
    const t2 = readJson(t2Path);
    Object.assign(allText, t2.events || t2);
  }
} else {
  const idxPath = path.join(SHARD_DIR, 'index.json');
  const idx = readJson(idxPath);
  for (const s of idx.shards) {
    const sp = readJson(path.join(SHARD_DIR, s.file));
    Object.assign(allText, sp.events || sp);
  }
}

const allEvents = [...(past.events || []), ...(core.events || [])];
allEvents.sort((a, b) => a.y - b.y || String(a.i).localeCompare(String(b.i)));

const picIds = new Set((pics.pictures || []).map((p) => p.id));
const momentPictures = {};
for (const ev of allEvents) {
  const ty = core.types[ev.ty];
  const id = ev.i;
  const txt = allText[id];
  if ((ev.moment || ty === 'moment') && txt?.picture?.src && !picIds.has(id)) {
    momentPictures[id] = txt.picture;
  }
}

// Also capture any orphan text keys not in allEvents just in case
const seenIds = new Set(allEvents.map((e) => e.i));
const orderedIds = allEvents.map((e) => e.i).filter((id) => allText[id] != null);
for (const id of Object.keys(allText)) {
  if (!seenIds.has(id)) orderedIds.push(id);
}

const yearById = new Map(allEvents.map((e) => [e.i, e.y]));
const perShard = Math.ceil(orderedIds.length / SHARD_COUNT);
const shardsMeta = [];
const shardSizes = {};

for (let i = 0; i < SHARD_COUNT; i++) {
  const sliceIds = orderedIds.slice(i * perShard, (i + 1) * perShard);
  if (!sliceIds.length) break;
  const file = `s${String(i).padStart(2, '0')}.json`;
  const shardEvents = {};
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const id of sliceIds) {
    shardEvents[id] = allText[id];
    const y = yearById.get(id);
    if (typeof y === 'number') {
      if (y < minYear) minYear = y;
      if (y > maxYear) maxYear = y;
    }
  }
  const payload = JSON.stringify({ events: shardEvents });
  fs.writeFileSync(path.join(SHARD_DIR, file), payload);
  shardSizes[`text_shards/${file}`] = Buffer.byteLength(payload);
  shardsMeta.push({
    file,
    minYear: Number.isFinite(minYear) ? minYear : 0,
    maxYear: Number.isFinite(maxYear) ? maxYear : 0,
    count: sliceIds.length,
    ids: sliceIds,
  });
}

const hash = crypto
  .createHash('sha1')
  .update(JSON.stringify(shardsMeta.map((s) => [s.file, s.count, s.minYear, s.maxYear])))
  .digest('hex')
  .slice(0, 10);

const indexPayload = JSON.stringify({
  version: hash,
  total: orderedIds.length,
  shards: shardsMeta,
  momentPictures,
});
fs.writeFileSync(path.join(SHARD_DIR, 'index.json'), indexPayload);

// Remove duplicate monolithic files so repository & Pages artifact shrink by ~10.5 MB
if (fs.existsSync(t1Path)) fs.unlinkSync(t1Path);
if (fs.existsSync(t2Path)) fs.unlinkSync(t2Path);

// Update manifest.json cleanly
manifest.core = (manifest.core || []).filter(
  (f) => f !== 'events_text.json' && f !== 'events_text_2.json' && f !== 'text_shards/index.json',
);
if (!manifest.core.includes('text_shards/index.json')) {
  manifest.core.push('text_shards/index.json');
}
delete manifest.sizes['events_text.json'];
delete manifest.sizes['events_text_2.json'];
manifest.sizes['text_shards/index.json'] = Buffer.byteLength(indexPayload);
Object.assign(manifest.sizes, shardSizes);
manifest.text_shards = shardsMeta.length;
delete manifest.text_parts;
fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest));

// Build polyphone-aware Pinyin + initials search index for all 4,828 Chinese titles
const toPinyinTokens = (str) => {
  const cjkOnly = (str || '').replace(/[^\u4e00-\u9fff]/g, '');
  if (!cjkOnly) return '';
  const arr = pinyin(cjkOnly, { toneType: 'none', type: 'array' });
  const full = arr.join('').toLowerCase();
  const init = arr.map((s) => s[0] || '').join('').toLowerCase();
  return `${full} ${init}`;
};

const pyEvents = {};
for (const [id, titleZh] of Object.entries(zh.events || {})) {
  const tok = toPinyinTokens(titleZh);
  if (tok) pyEvents[id] = tok;
}

const zhSearchPayload = JSON.stringify({
  version: hash,
  py: pyEvents,
});
fs.writeFileSync(path.join(DATA, 'zh_search.json'), zhSearchPayload);

console.log(
  `Built ${shardsMeta.length} text shards (avg ${Math.round(
    Object.values(shardSizes).reduce((a, b) => a + b, 0) / shardsMeta.length / 1024,
  )} KB), index.json (${(Buffer.byteLength(indexPayload) / 1024).toFixed(1)} KB, ${
    Object.keys(momentPictures).length
  } moment pictures), and zh_search.json (${(Buffer.byteLength(zhSearchPayload) / 1024).toFixed(1)} KB).`,
);
