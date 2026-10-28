'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generate } = require('./make-fixtures');
const { loadEvents, parseClaude, parseCodex } = require('../src/parse');
const { computeStats, commandHead } = require('../src/stats');
const { renderHTML } = require('../src/render');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wrapped-'));
generate(dir);
const sources = [
  { agent: 'claude-code', dir: path.join(dir, 'claude') },
  { agent: 'codex', dir: path.join(dir, 'codex') },
];

test('loads both agents', () => {
  const { events, found } = loadEvents(sources);
  assert.ok(events.length > 1000);
  assert.ok(found['claude-code'] > 0 && found.codex > 0);
});

test('counts usage once per assistant message', () => {
  const f = path.join(dir, 'one.jsonl');
  const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const line = (content) => JSON.stringify({ type: 'assistant', timestamp: '2026-05-01T10:00:00Z', sessionId: 's', requestId: 'r', message: { id: 'm', usage, content } });
  fs.writeFileSync(f, [line([{ type: 'text', text: 'hi' }]), line([{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }])].join('\n'));
  const evs = parseClaude(f);
  const s = computeStats(evs);
  assert.strictEqual(s.totalTokens, 15);
  assert.strictEqual(s.toolCalls, 1);
});

test('computes stats and personas', () => {
  const { events } = loadEvents(sources);
  const s = computeStats(events);
  assert.ok(s.userMessages > 100);
  assert.ok(s.phrases.absolutelyRight > 0);
  assert.ok(s.interruptions > 0);
  assert.ok(s.topTools.length > 0);
  assert.ok(s.topCommands.some((c) => c.name === 'git status'));
  assert.ok(s.personas.length > 0);
  assert.ok(s.longestStreak >= 1);
});

test('date filtering', () => {
  const { events } = loadEvents(sources);
  const s = computeStats(events, { since: '2026-09-01', until: '2026-10-01' });
  assert.ok(s.range.from >= '2026-09-01' && s.range.to < '2026-10-01');
});

test('command head', () => {
  assert.strictEqual(commandHead('npm run build'), 'npm run build');
  assert.strictEqual(commandHead(['bash', '-lc', 'git status']), 'git status');
  assert.strictEqual(commandHead('FOO=1 python x.py'), 'python');
  assert.strictEqual(commandHead('cd "/c/Users/me/my projects/app" && npm test'), 'npm test');
  assert.strictEqual(commandHead('cd src; git diff --stat'), 'git diff');
  assert.strictEqual(commandHead('powershell -Command "Get-ChildItem C:\\\\x"'), 'Get-ChildItem');
  assert.strictEqual(commandHead(['bash', '-lc', 'cd /tmp && ls -la']), 'ls');
});

test('codex prompts drop injected text', () => {
  const f = path.join(dir, 'codex-noise.jsonl');
  const msg = (text) => JSON.stringify({ timestamp: '2026-05-01T10:00:00Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
  fs.writeFileSync(f, [
    msg('The following is the Codex agent history so far'),
    msg('# Files mentioned by the user:\n\n## a.js\n...\n## My request for Codex:\nFIX THE LOGIN PAGE NOW'),
    msg('<environment_context>cwd</environment_context>'),
    msg('<turn_aborted>\nThe user interrupted</turn_aborted>'),
    msg('<in-app-browser-context source="x">page</in-app-browser-context>\nplease add dark mode'),
  ].join('\n'));
  const s = computeStats(parseCodex(f));
  assert.strictEqual(s.userMessages, 2);
  assert.strictEqual(s.interruptions, 1);
  assert.strictEqual(s.user.caps, 1);
  assert.strictEqual(s.user.please, 1);
});

test('html escapes data', () => {
  const { events } = loadEvents(sources);
  const s = computeStats(events);
  s.topFiles = [{ name: '</script><img onerror=alert(1)>', value: 1 }];
  const html = renderHTML(s);
  assert.ok(!html.includes('</script><img'));
});
