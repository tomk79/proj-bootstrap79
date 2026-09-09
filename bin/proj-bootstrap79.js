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
const rl = createInterface({ input: stdin, terminal: stdin.isTTY === true });
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on('close', () => { closed = true; waiters.splice(0).forEach((w) => w(null)); });

function readLine() {
  if (lines.length) return Promise.resolve(lines.shift());
  if (closed) return Promise.resolve(null);
  return new Promise((r) => waiters.push(r));
}
async function ask(prompt) {
  stdout.write(prompt);
  const l = await readLine();
  if (l === null) { stdout.write('\n入力が閉じられました。--name= --type= --stack= --ci= --hosting= で指定もできます。\n'); exit(1); }
  return l.trim();
}
async function choose(flag, question, table, filter) {
  const keys = Object.keys(table).filter((k) => !filter || !table[k].for || table[k].for.includes(filter));
  if (flags[flag]) {
    if (keys.includes(flags[flag])) return flags[flag];
    stdout.write(`--${flag}=${flags[flag]} は選べません。候補: ${keys.join(', ')}\n`); exit(1);
  }
  stdout.write(`\n${question}\n`);
  keys.forEach((k, i) => stdout.write(`  ${i + 1}) ${table[k].label}\n`));
  for (;;) {
    const ans = await ask('> ');
    const n = Number(ans);
    if (n >= 1 && n <= keys.length) return keys[n - 1];
    if (keys.includes(ans)) return ans;
    stdout.write('番号で選んでください。\n');
  }
}

const appName = flags.name ?? ((await ask(`\nアプリの名前（既定: ${basename(target)}）\n> `)) || basename(target));
const appType = await choose('type', '作りたいアプリは？', APP_TYPES);
const stack = await choose('stack', 'スタックは？', STACKS, appType);
const ci = await choose('ci', 'CI は？', CI);
const hosting = await choose('hosting', 'ホスティングは？', HOSTING, appType);
rl.close();

const vars = {
  APP_NAME: appName,
  APP_TYPE: APP_TYPES[appType].label,
  STACK: STACKS[stack].label,
  CI: CI[ci].label,
  HOSTING: HOSTING[hosting].label,
  STACK_SECTION: readIfExists(join(TEMPLATES, 'stack', stack, 'STACK.md')) ?? '（このスタックの作法はまだ整備されていない）',
  SCAFFOLD: STACKS[stack].scaffold,
  DATE: new Date().toISOString().slice(0, 10),
};

const written = [];
const skipped = [];

copyTree(join(TEMPLATES, 'base'), target);
const stackFiles = join(TEMPLATES, 'stack', stack, 'files');
if (existsSync(stackFiles)) copyTree(stackFiles, target);

stdout.write('\n置いたもの:\n');
written.forEach((f) => stdout.write(`  + ${f}\n`));
if (skipped.length) {
  stdout.write('既にあるので触らなかったもの（--force で上書き）:\n');
  skipped.forEach((f) => stdout.write(`  = ${f}\n`));
}
stdout.write(`
次にやること:
  1. git init && git add -A && git commit -m "置き手紙"
  2. ${vars.SCAFFOLD}
  3. docs/GRILL.md の空欄を埋める（grill-me に渡す）
  4. テストとビルドが空のまま緑になることを確かめてから、最初の機能に入る
`);

// ---- helpers ----
function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
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
