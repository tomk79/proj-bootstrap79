#!/usr/bin/env node
// proj-bootstrap79: 新しいリポジトリの初手。
// 依存ゼロ（Node 20+ の標準モジュールだけ）。npx で落ちてくるものを最小にするため。

import { createInterface } from 'node:readline';
import { stdin, stdout, argv, cwd, exit } from 'node:process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_TYPES, STACKS, CI, HOSTING } from '../lib/questions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = join(ROOT, 'templates');
const force = argv.includes('--force');
const target = cwd();

// --name= --type= --stack= --ci= --hosting= で答えを先渡しできる（AI や CI から呼ぶ用）。
const flags = Object.fromEntries(
  argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split(/=(.*)/s).slice(0, 2)),
);

// パイプ入力でも取りこぼさないよう、行は自前のキューに溜める。
const lines = [];
const waiters = [];
let closed = false;
const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY === true });
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on('close', () => { closed = true; waiters.splice(0).forEach((w) => w(null)); });

function readLine() {
  if (lines.length) return Promise.resolve(lines.shift());
  if (closed) return Promise.resolve(null);
  return new Promise((r) => waiters.push(r));
}
async function ask(prompt) {
  // 端末では readline が入力をエコーする。プロンプトは readline に持たせないと桁がずれる。
  rl.setPrompt(prompt);
  rl.prompt();
  const l = await readLine();
  if (l === null) { stdout.write('\n入力が閉じられました。--name= --type= --stack= --ci= --hosting= で指定もできます。\n'); exit(1); }
  return l.trim();
}
// types は選ばれたアプリ種別の配列。for を持つ選択肢は、どれかに該当するものだけ残す。
function allow(table, types) {
  return Object.keys(table).filter((k) => !types || !table[k].for || table[k].for.some((t) => types.includes(t)));
}
function parseList(v) {
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}
function resolve(keys, ans) {
  const n = Number(ans);
  if (n >= 1 && n <= keys.length) return keys[n - 1];
  return keys.includes(ans) ? ans : null;
}
async function choose(flag, question, table, types) {
  const keys = allow(table, types);
  if (flag && flags[flag]) {
    if (keys.includes(flags[flag])) return flags[flag];
    stdout.write(`--${flag}=${flags[flag]} は選べません。候補: ${keys.join(', ')}\n`); exit(1);
  }
  stdout.write(`\n${question}\n`);
  keys.forEach((k, i) => stdout.write(`  ${i + 1}) ${table[k].label}\n`));
  for (;;) {
    const hit = resolve(keys, await ask('> '));
    if (hit) return hit;
    stdout.write('番号で選んでください。\n');
  }
}
// 複数選べる質問。デスクトップに対応するモバイルや紹介用のウェブが要ることがあるため。
async function chooseMany(flag, question, table) {
  const keys = Object.keys(table);
  if (flags[flag]) {
    const picked = keys.filter((k) => parseList(flags[flag]).includes(k));
    if (picked.length !== new Set(parseList(flags[flag])).size || !picked.length) {
      stdout.write(`--${flag}=${flags[flag]} は選べません。候補: ${keys.join(', ')}（カンマ区切りで複数可）\n`); exit(1);
    }
    return picked;
  }
  stdout.write(`\n${question}\n`);
  keys.forEach((k, i) => stdout.write(`  ${i + 1}) ${table[k].label}\n`));
  stdout.write('  （複数選べる。カンマ区切りで: 1,3）\n');
  for (;;) {
    const picked = parseList(await ask('> ')).map((a) => resolve(keys, a));
    if (picked.length && picked.every(Boolean)) return keys.filter((k) => picked.includes(k));
    stdout.write('番号で選んでください（複数ならカンマ区切り）。\n');
  }
}
// 種別ごとに1つずつスタックを決める。--stack= はカンマ区切りで、どの種別のものかは for から引く。
async function chooseStacks(types) {
  const picked = flags.stack ? parseList(flags.stack) : null;
  const out = new Map();
  for (const t of types) {
    const keys = allow(STACKS, [t]);
    if (!picked) { out.set(t, await choose(null, `${APP_TYPES[t].label}のスタックは？`, STACKS, [t])); continue; }
    const hit = picked.filter((k) => keys.includes(k));
    if (hit.length !== 1) {
      stdout.write(`--stack= には ${APP_TYPES[t].label} のスタックを1つ入れること。候補: ${keys.join(', ')}\n`); exit(1);
    }
    out.set(t, hit[0]);
  }
  const unused = (picked ?? []).filter((k) => ![...out.values()].includes(k));
  if (unused.length) { stdout.write(`--stack=${unused.join(',')} は選んだ種別に対応しません。\n`); exit(1); }
  return out;
}

const appName = flags.name ?? ((await ask(`\nアプリの名前（既定: ${basename(target)}）\n> `)) || basename(target));
const appTypes = await chooseMany('type', '作りたいアプリは？（複数可）', APP_TYPES);
const stacks = await chooseStacks(appTypes);
const ci = await choose('ci', 'CI は？', CI);
const hosting = await choose('hosting', 'ホスティングは？', HOSTING, appTypes);
rl.close();

// 2つ以上抱えるなら apps/<種別>/ に分ける。1つなら従来どおりリポジトリ直下。
const multi = appTypes.length > 1;
const appDir = (t) => (multi ? `apps/${t}` : '.');
const scaffoldCmd = (t) => {
  const cmd = STACKS[stacks.get(t)].scaffold;
  return multi ? `mkdir -p ${appDir(t)} && (cd ${appDir(t)} && ${cmd})` : cmd;
};

const vars = {
  APP_NAME: appName,
  APP_TYPE: appTypes.map((t) => APP_TYPES[t].label).join(' / '),
  STACK: appTypes.map((t) => (multi ? `${APP_TYPES[t].label}: ${STACKS[stacks.get(t)].label}` : STACKS[stacks.get(t)].label)).join(' / '),
  CI: CI[ci].label,
  HOSTING: HOSTING[hosting].label,
  STACK_SECTION: stackSection(),
  SCAFFOLD: appTypes.map(scaffoldCmd).join('\n'),
  DATE: new Date().toISOString().slice(0, 10),
};

const written = [];
const skipped = [];

copyTree(join(TEMPLATES, 'base'), target);
for (const key of new Set(stacks.values())) {
  const stackFiles = join(TEMPLATES, 'stack', key, 'files');
  if (existsSync(stackFiles)) copyTree(stackFiles, target);
}

stdout.write('\n置いたもの:\n');
written.forEach((f) => stdout.write(`  + ${f}\n`));
if (skipped.length) {
  stdout.write('既にあるので触らなかったもの（--force で上書き）:\n');
  skipped.forEach((f) => stdout.write(`  = ${f}\n`));
}
// スキャフォルダを先に走らせない。何を作らないかが決まる前に雛形を置くと、それが仕様になる。
const steps = [
  'git init && git add -A && git commit -m "置き手紙"',
  '/grill-me で docs/GRILL.md の空欄を埋める（プロンプトの例は下）',
  '埋まった方針に合わせて、公式スキャフォルダを走らせる（候補は下）',
  'テストとビルドが空のまま緑になることを確かめてから、最初の機能に入る',
];
stdout.write('\n次にやること:\n' + steps.map((s, i) => `  ${i + 1}. ${s}\n`).join(''));

stdout.write('\n2. で /grill-me に渡すプロンプトの例（そのまま貼って、括弧の中は書き換える）:\n\n');
stdout.write(grillPrompt().split('\n').map((l) => `  ${l}\n`).join(''));

stdout.write('\n3. のスキャフォルダの候補（選んだスタックの公式コマンド。grill-me の結論次第で変わるので、\n   決まってから叩く。スタックごと変えることになってもここで止められる）:\n');
appTypes.forEach((t) => stdout.write(`  ${multi ? `${APP_TYPES[t].label}: ` : ''}${scaffoldCmd(t)}\n`));

// ---- helpers ----
// grill-me に貼るためのプロンプト。答えた内容は埋めておき、人間にしか書けない部分だけ括弧で残す。
function grillPrompt() {
  return [
    `docs/GRILL.md の空欄を埋めたい。`,
    `${appName} は${vars.APP_TYPE}のアプリで、スタックは ${vars.STACK}${ci === 'none' ? '' : `、CI は ${vars.CI}`}${hosting === 'none' ? '' : `、ホスティングは ${vars.HOSTING}`} のつもり。`,
    `作りたいのは（一言で書く）。使うのは（最初の1人を具体的に）。`,
    `「何を作らないか」と「変えられない決定」がまだ決まっていないので、そこを詰めてほしい。`,
    `決まったことは docs/GRILL.md に書き込み、決まらなかったものは「まだ決めていないこと」に残すこと。`,
  ].join('\n');
}
function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
// 種別ごとの作法を並べる。2つ以上なら見出しと置き場を付けて、どれの話か分かるようにする。
function stackSection() {
  const parts = appTypes.map((t) => {
    const key = stacks.get(t);
    const body = readIfExists(join(TEMPLATES, 'stack', key, 'STACK.md')) ?? '（このスタックの作法はまだ整備されていない）\n';
    return multi ? `### ${APP_TYPES[t].label} — ${STACKS[key].label}\n\n置き場: \`${appDir(t)}/\`\n\n${body}` : body;
  });
  if (multi) {
    parts.unshift('プラットフォームごとに `apps/<種別>/` に分ける。共有するコードは `packages/` に切り出す（何を共有するかは docs/GRILL.md で決める）。\n');
  }
  return `${parts.join('\n').trimEnd()}\n`;
}
function render(text) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}
function copyTree(src, dst) {
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyTree(s, d);
      continue;
    }
    const rel = relative(target, d);
    if (existsSync(d) && !force) { skipped.push(rel); continue; }
    mkdirSync(dirname(d), { recursive: true });
    writeFileSync(d, render(readFileSync(s, 'utf8')));
    written.push(rel);
  }
}
