#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { loadEvents, defaultSources } = require('../src/parse');
const { computeStats } = require('../src/stats');
const { renderHTML } = require('../src/render');
const pkg = require('../package.json');

const HELP = `
  agent-wrapped — Spotify Wrapped for your AI coding agent

  Usage
    npx agent-wrapped [options]

  Options
    --year <yyyy>     Only this calendar year (default: last 365 days)
    --all             Use your whole history
    --since <date>    Start date, e.g. 2026-01-01
    --until <date>    End date (exclusive)
    --dir <path>      Read this transcript folder instead of the defaults (repeatable)
    --out <file>      Where to write the HTML (default: ./agent-wrapped.html)
    --json            Print raw stats as JSON instead of writing HTML
    --no-open         Don't open the browser
    -v, --version     Print version
    -h, --help        Show this help

  Reads Claude Code (~/.claude/projects) and Codex (~/.codex/sessions).
  Everything runs locally. Nothing leaves your machine.
`;

function parseArgs(argv) {
  const o = { dirs: [], open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v == null) die(`Missing value for ${a}`); return v; };
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (a === '--year') o.year = val();
    else if (a === '--all') o.all = true;
    else if (a === '--since') o.since = val();
    else if (a === '--until') o.until = val();
    else if (a === '--dir') o.dirs.push(val());
    else if (a === '--out') o.out = val();
    else if (a === '--json') o.json = true;
    else if (a === '--no-open') o.open = false;
    else die(`Unknown option: ${a}\n${HELP}`);
  }
  return o;
}

function die(msg) { console.error(msg); process.exit(1); }

function openFile(file) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  execFile(cmd, args, () => {});
}

const c = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c(1), dim = c(2), pink = c(95), cyan = c(96);

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return console.log(HELP);
  if (o.version) return console.log(pkg.version);

  if (o.year && !/^\d{4}$/.test(o.year)) die(`--year expects a year like 2026, got "${o.year}"`);
  for (const k of ['since', 'until']) {
    if (o[k] && isNaN(new Date(o[k]))) die(`--${k} expects a date like 2026-01-01, got "${o[k]}"`);
  }

  const sources = o.dirs.length ? o.dirs.map((d) => ({ agent: /codex/i.test(d) ? 'codex' : 'claude-code', dir: path.resolve(d) })) : defaultSources();
  const { events, found } = loadEvents(sources);
  if (!events.length) {
    die(o.dirs.length
      ? `No agent transcripts (.jsonl) found in ${o.dirs.join(', ')}.`
      : 'No agent transcripts found in ~/.claude/projects or ~/.codex/sessions.\nUse --dir <path> to point at a transcript folder.');
  }

  let since = o.since, until = o.until;
  if (o.year) { since = `${o.year}-01-01T00:00:00`; until = `${+o.year + 1}-01-01T00:00:00`; }
  else if (!o.all && !since) since = new Date(Date.now() - 365 * 86400000).toISOString();

  const stats = computeStats(events, { since, until });
  if (!stats.userMessages) die('Found transcripts, but no prompts in that date range. Try --all.');

  if (o.json) return console.log(JSON.stringify(stats, null, 2));

  const out = path.resolve(o.out || 'agent-wrapped.html');
  fs.writeFileSync(out, renderHTML(stats));

  const p = stats.personas[0];
  const fmt = (n) => Number(n).toLocaleString('en-US');
  console.log('');
  console.log(pink(bold('  🎁  Agent Wrapped')) + dim(`  ${stats.range.from} → ${stats.range.to}`));
  console.log(dim(`      read ${Object.entries(found).map(([k, v]) => `${v} ${k} files`).join(', ')}`));
  console.log('');
  console.log(`  ${bold(fmt(stats.userMessages))} prompts · ${bold(fmt(stats.sessions))} sessions · ${bold(stats.activeHours)} hours`);
  console.log(`  ${bold(fmt(stats.totalTokens))} tokens · ${bold(fmt(stats.toolCalls))} tool calls`);
  console.log(`  "You're absolutely right" × ${bold(stats.phrases.absolutelyRight)}`);
  console.log('');
  console.log(`  You are ${cyan(bold(p.title))}. ${dim(p.blurb)}`);
  console.log('');
  console.log(`  ${dim('Your Wrapped →')} ${out}`);
  console.log('');
  if (o.open) openFile(out);
}

main();
