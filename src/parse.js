'use strict';
// Readers for local coding-agent transcripts. Everything stays on disk; nothing is uploaded.

const fs = require('fs');
const path = require('path');
const os = require('os');

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function readLines(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* skip partial lines */ }
  }
  return rows;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c && (c.type === 'text' || c.type === 'input_text' || c.type === 'output_text'))
    .map((c) => c.text || '')
    .join('\n');
}

// Normalized event shape:
// { agent, session, project, ts: Date, role: 'user'|'assistant', text, tools: [{name, input}], usage, model }

function parseClaude(file) {
  const events = [];
  const seenUsage = new Set();
  for (const d of readLines(file)) {
    if (d.type !== 'user' && d.type !== 'assistant') continue;
    if (!d.message || !d.timestamp) continue;
    const ts = new Date(d.timestamp);
    if (isNaN(ts)) continue;
    const msg = d.message;
    const content = Array.isArray(msg.content) ? msg.content : [];
    const isToolResult = content.length > 0 && content.every((c) => c && c.type === 'tool_result');
    const ev = {
      agent: 'claude-code',
      session: d.sessionId || path.basename(file, '.jsonl'),
      project: d.cwd ? path.basename(d.cwd) : null,
      ts,
      role: d.type,
      text: isToolResult ? '' : textOf(msg.content),
      tools: content.filter((c) => c && c.type === 'tool_use').map((c) => ({ name: c.name, input: c.input || {} })),
      usage: null,
      model: msg.model || null,
      toolResult: isToolResult,
      sidechain: !!d.isSidechain,
    };
    // Claude Code writes one line per content block and repeats usage on each; count it once.
    if (d.type === 'assistant' && msg.usage) {
      const key = (msg.id || '') + (d.requestId || '');
      if (!key || !seenUsage.has(key)) {
        if (key) seenUsage.add(key);
        ev.usage = {
          input: msg.usage.input_tokens || 0,
          output: msg.usage.output_tokens || 0,
          cacheRead: msg.usage.cache_read_input_tokens || 0,
          cacheWrite: msg.usage.cache_creation_input_tokens || 0,
        };
      }
    }
    events.push(ev);
  }
  return events;
}

function parseCodex(file) {
  const events = [];
  let session = path.basename(file, '.jsonl');
  let project = null;
  let lastTotal = null;
  for (const d of readLines(file)) {
    const p = d.payload || {};
    const ts = new Date(d.timestamp);
    if (d.type === 'session_meta') {
      session = p.id || session;
      if (p.cwd) project = path.basename(p.cwd);
      continue;
    }
    if (isNaN(ts)) continue;
    const base = { agent: 'codex', session, project, ts, text: '', tools: [], usage: null, model: null, toolResult: false, sidechain: false };
    if (d.type === 'turn_context' && p.cwd) project = path.basename(p.cwd);
    if (d.type === 'response_item' && p.type === 'message' && (p.role === 'user' || p.role === 'assistant')) {
      const text = textOf(p.content);
      // Codex injects environment context as user messages; skip those.
      if (p.role === 'user' && /^\s*<(environment_context|user_instructions)/.test(text)) continue;
      events.push({ ...base, role: p.role, text });
    } else if (d.type === 'response_item' && (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call')) {
      let input = {};
      try { input = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : (p.arguments || p.input || {}); } catch { input = {}; }
      if (p.type === 'local_shell_call' && p.action) input = { command: p.action.command };
      const name = p.name || (p.type === 'local_shell_call' ? 'shell' : 'tool');
      events.push({ ...base, role: 'assistant', tools: [{ name, input }] });
    } else if (d.type === 'event_msg' && p.type === 'token_count' && p.info && p.info.total_token_usage) {
      const t = p.info.total_token_usage;
      if (lastTotal && t.total_tokens === lastTotal.total_tokens) continue;
      const prev = lastTotal || { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
      lastTotal = t;
      events.push({
        ...base,
        role: 'assistant',
        usage: {
          input: Math.max(0, (t.input_tokens || 0) - (prev.input_tokens || 0) - ((t.cached_input_tokens || 0) - (prev.cached_input_tokens || 0))),
          output: Math.max(0, (t.output_tokens || 0) - (prev.output_tokens || 0)),
          cacheRead: Math.max(0, (t.cached_input_tokens || 0) - (prev.cached_input_tokens || 0)),
          cacheWrite: 0,
        },
      });
    }
  }
  return events;
}

function defaultSources() {
  const home = os.homedir();
  const claudeRoot = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
  const codexRoot = process.env.CODEX_HOME || path.join(home, '.codex');
  return [
    { agent: 'claude-code', dir: path.join(claudeRoot, 'projects') },
    { agent: 'codex', dir: path.join(codexRoot, 'sessions') },
    { agent: 'codex', dir: path.join(codexRoot, 'archived_sessions') },
  ];
}

function loadEvents(sources = defaultSources()) {
  const events = [];
  const found = {};
  for (const src of sources) {
    const files = walk(src.dir);
    if (files.length) found[src.agent] = (found[src.agent] || 0) + files.length;
    for (const f of files) events.push(...(src.agent === 'codex' ? parseCodex(f) : parseClaude(f)));
  }
  events.sort((a, b) => a.ts - b.ts);
  return { events, found };
}

module.exports = { loadEvents, parseClaude, parseCodex, defaultSources };
