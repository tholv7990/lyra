#!/usr/bin/env node
// Swap the marketplace catalog: delete the imported prompts.chat docs and insert
// the curated Lyra set (data/lyra-marketplace-prompts.json).
//
//   node scripts/swap-marketplace-prompts.cjs            # DRY RUN (reports only)
//   node scripts/swap-marketplace-prompts.cjs --commit   # apply (backs up first)
//
// Safe by default: nothing is mutated without --commit. Deleted docs are backed up
// to data/marketplace-backup-<ts>.json, and the originals are also reproducible
// from data/prompts_2026-06-19.csv. Dev DB only.

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');
// Resolve mongoose from the api workspace, regardless of where node is invoked.
const apiRequire = createRequire(path.join(ROOT, 'apps', 'api', 'package.json'));
const mongoose = apiRequire('mongoose');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lyra?replicaSet=rs0';
const COMMIT = process.argv.includes('--commit');
const DATA = path.join(ROOT, 'data', 'lyra-marketplace-prompts.json');
const COLLECTION = 'marketplaceprompts';
const SOURCE_OLD = 'prompts.chat';
const SOURCE_NEW = 'Lyra';

// Parse {token} / {token:default} placeholders -> unique variable names.
function parseVars(s) {
  const set = new Set();
  const re = /\{([a-zA-Z0-9_]+)(?::[^}]*)?\}/g;
  let m;
  while ((m = re.exec(s))) set.add(m[1]);
  return [...set];
}

(async () => {
  const items = JSON.parse(fs.readFileSync(DATA, 'utf8'));

  // validate: unique titles + required fields
  const titles = items.map((i) => i.title);
  if (new Set(titles).size !== titles.length) throw new Error('Duplicate titles in data file');
  for (const i of items) {
    if (!i.title || !i.content || !i.category) {
      throw new Error(`Missing required field in: ${i.title || '(no title)'}`);
    }
  }

  const now = new Date();
  const docs = items.map((i) => ({
    title: i.title,
    description: i.description || '',
    content: i.content,
    type: 'text',
    forDevs: false,
    source: SOURCE_NEW,
    category: i.category,
    variables: parseVars(i.content),
    tags: i.tags || [],
    createdAt: now,
    updatedAt: now,
  }));

  await mongoose.connect(URI);
  const col = mongoose.connection.db.collection(COLLECTION);
  const total = await col.countDocuments();
  const toDelete = await col.countDocuments({ source: SOURCE_OLD });
  const lyraExisting = await col.countDocuments({ source: SOURCE_NEW });

  console.log(`DB: ${URI}`);
  console.log(`collection ${COLLECTION}: total=${total}, source='${SOURCE_OLD}'=${toDelete}, source='${SOURCE_NEW}'=${lyraExisting}`);
  console.log(`data file: ${docs.length} prompts to insert (vars sample: ${docs[0].variables.join(', ')})`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing changed. Re-run with --commit to apply.');
    await mongoose.disconnect();
    return;
  }

  const backup = await col.find({ source: SOURCE_OLD }).toArray();
  const backupPath = path.join(ROOT, 'data', `marketplace-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nbacked up ${backup.length} docs -> ${backupPath}`);

  const del = await col.deleteMany({ source: SOURCE_OLD });
  const ins = await col.insertMany(docs);
  const newTotal = await col.countDocuments();
  console.log(`deleted=${del.deletedCount}, inserted=${ins.insertedCount}, new total=${newTotal}`);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
