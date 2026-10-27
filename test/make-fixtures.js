'use strict';
// Generates a fake but realistic year of Claude Code + Codex transcripts.
// Used for tests and for the demo screenshots, so no real history is ever needed.

const fs = require('fs');
const path = require('path');

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

function generate(outDir, { seed = 42, days = 300, end = new Date('2026-10-20T00:00:00') } = {}) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const projects = ['acme-dashboard', 'rust-raytracer', 'portfolio', 'api-gateway', 'mobile-app', 'dotfiles'];
  const files = ['App.tsx', 'index.ts', 'schema.prisma', 'main.rs', 'styles.css', 'README.md', 'api.ts', 'utils.py'];
  const cmds = ['npm test', 'git status', 'npm run build', 'ls -la', 'git diff', 'cargo build', 'pytest -q', 'grep -rn TODO .'];
  const prompts = ['please fix the failing test', 'why is this slow?', 'add dark mode thanks', 'no, revert that', 'refactor the auth flow', 'WHY IS IT STILL BROKEN!!', 'ship it', 'write tests for api.ts please'];
  const replies = ["You're absolutely right! Let me fix that.", 'Great question. The bottleneck is the N+1 query.', 'Done. All tests pass.', 'I apologize for the confusion, reverting now.', 'Perfect! The build is green.'];

  const claudeDir = path.join(outDir, 'claude', 'demo-project');
  const codexDir = path.join(outDir, 'codex', '2026');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });

  let n = 0;
  for (let d = days; d >= 0; d--) {
    if (r() < 0.25) continue;
    const day = new Date(end.getTime() - d * 86400000);
    const sessionsToday = 1 + Math.floor(r() * 3);
    for (let s = 0; s < sessionsToday; s++) {
      const id = `sess-${++n}`;
      const project = pick(projects);
      const hour = r() < 0.35 ? 22 + Math.floor(r() * 4) : 9 + Math.floor(r() * 10);
      let t = new Date(day); t.setHours(hour % 24, Math.floor(r() * 60));
      const iso = () => { t = new Date(t.getTime() + (20 + r() * 200) * 1000); return t.toISOString(); };
      const codex = r() < 0.2;
      const lines = [];
      if (codex) lines.push({ timestamp: iso(), type: 'session_meta', payload: { id, cwd: `/home/dev/${project}` } });
      let tokens = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, total_tokens: 0 };
      const turns = 2 + Math.floor(r() * 8);
      for (let k = 0; k < turns; k++) {
        const prompt = pick(prompts);
        if (codex) {
          lines.push({ timestamp: iso(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] } });
          lines.push({ timestamp: iso(), type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['bash', '-lc', pick(cmds)] }) } });
          lines.push({ timestamp: iso(), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: pick(replies) }] } });
          tokens = { input_tokens: tokens.input_tokens + 9000, output_tokens: tokens.output_tokens + 700, cached_input_tokens: tokens.cached_input_tokens + 6000, total_tokens: tokens.total_tokens + 9700 };
          lines.push({ timestamp: iso(), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { ...tokens } } } });
          continue;
        }
        const base = { sessionId: id, cwd: `/home/dev/${project}` };
        lines.push({ ...base, type: 'user', timestamp: iso(), message: { role: 'user', content: prompt } });
        const msgId = `msg-${n}-${k}`;
        const usage = { input_tokens: 40 + Math.floor(r() * 400), output_tokens: 300 + Math.floor(r() * 2500), cache_read_input_tokens: 20000 + Math.floor(r() * 60000), cache_creation_input_tokens: Math.floor(r() * 4000) };
        const model = 'claude-opus-5-5';
        lines.push({ ...base, type: 'assistant', timestamp: iso(), requestId: `req-${msgId}`, message: { id: msgId, model, role: 'assistant', usage, content: [{ type: 'text', text: pick(replies) }] } });
        const tc = 1 + Math.floor(r() * 6);
        for (let j = 0; j < tc; j++) {
          const kind = r();
          const tool = kind < 0.35 ? { name: 'Edit', input: { file_path: `/home/dev/${project}/src/${pick(files)}`, old_string: 'a', new_string: 'b\nc' } }
            : kind < 0.65 ? { name: 'Bash', input: { command: pick(cmds) } }
            : kind < 0.85 ? { name: 'Read', input: { file_path: `/home/dev/${project}/${pick(files)}` } }
            : { name: 'Grep', input: { pattern: 'TODO' } };
          // Same message id + usage repeated, as Claude Code does per content block.
          lines.push({ ...base, type: 'assistant', timestamp: iso(), requestId: `req-${msgId}`, message: { id: msgId, model, role: 'assistant', usage, content: [{ type: 'tool_use', id: `tu-${j}`, ...tool }] } });
          lines.push({ ...base, type: 'user', timestamp: iso(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `tu-${j}`, content: 'ok' }] } });
        }
        if (r() < 0.12) lines.push({ ...base, type: 'user', timestamp: iso(), message: { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] } });
      }
      const dir = codex ? codexDir : claudeDir;
      fs.writeFileSync(path.join(dir, `${codex ? 'rollout-' : ''}${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    }
  }
  return outDir;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || 'demo');
  generate(out);
  console.log('fixtures written to', out);
}

module.exports = { generate };
