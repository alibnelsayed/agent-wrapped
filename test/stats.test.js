'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generate } = require('./make-fixtures');
const { loadEvents, parseClaude } = require('../src/parse');
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
});

test('html escapes data', () => {
  const { events } = loadEvents(sources);
  const s = computeStats(events);
  s.topFiles = [{ name: '</script><img onerror=alert(1)>', value: 1 }];
  const html = renderHTML(s);
  assert.ok(!html.includes('</script><img'));
});
