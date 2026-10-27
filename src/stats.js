'use strict';

const path = require('path');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// A novel of War and Peace's length is roughly 780k tokens.
const WAR_AND_PEACE_TOKENS = 780000;
const SESSION_GAP_MS = 30 * 60 * 1000;

const PHRASES = {
  absolutelyRight: /you'?re absolutely right/gi,
  apologies: /\b(i apologi[sz]e|sorry about that|my apologies|you'?re right, i)\b/gi,
  greatQuestion: /\bgreat (question|catch|idea|point)\b/gi,
  perfect: /^\s*perfect[!.]/gim,
};
const USER_PHRASES = {
  please: /\bplease\b|\bplz\b/gi,
  thanks: /\b(thanks|thank you|thx|ty)\b/gi,
  no: /^\s*(no|nope|wrong|stop|wait)\b/gim,
  why: /\bwhy\b/gi,
  caps: /\b[A-Z]{4,}\b/g,
  bang: /!{2,}/g,
};

function count(re, text) {
  if (!text) return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

function top(map, n = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));
}

function inc(map, key, by = 1) {
  if (key == null || key === '') return;
  map.set(key, (map.get(key) || 0) + by);
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fileFromInput(input) {
  const p = input.file_path || input.path || input.notebook_path || input.filePath;
  return typeof p === 'string' ? path.basename(p) : null;
}

function commandHead(cmd) {
  if (Array.isArray(cmd)) cmd = cmd.join(' ');
  if (typeof cmd !== 'string') return null;
  // Codex wraps commands as ["bash","-lc","..."]
  cmd = cmd.replace(/^(bash|sh|zsh)\s+-l?c\s+/, '').replace(/^['"]/, '').trim();
  const words = cmd.split(/\s+/).filter((w) => !/^\w+=/.test(w) && w !== 'sudo' && w !== 'cd' && w !== '&&');
  let head = words[0] || null;
  if (!head) return null;
  head = path.basename(head.replace(/['"]/g, ''));
  if (['npm', 'pnpm', 'yarn', 'bun', 'git', 'docker', 'cargo', 'go', 'uv', 'pip', 'kubectl'].includes(head) && words[1] && !words[1].startsWith('-')) {
    head += ' ' + words[1];
    if (words[1] === 'run' && words[2]) head += ' ' + words[2];
  }
  return head.slice(0, 32);
}

function persona(s) {
  const p = [];
  const nightShare = s.hours.slice(0, 5).reduce((a, b) => a + b, 0) + s.hours[22] + s.hours[23];
  const total = s.hours.reduce((a, b) => a + b, 0) || 1;
  if (nightShare / total > 0.3) p.push({ id: 'night-owl', title: 'The Night Owl', blurb: 'Your best commits happen after the city goes quiet.' });
  if (s.interruptions / Math.max(1, s.sessions) > 1.5) p.push({ id: 'backseat', title: 'The Backseat Driver', blurb: 'You hit Esc like it owes you money.' });
  if ((s.user.please + s.user.thanks) / Math.max(1, s.userMessages) > 0.2) p.push({ id: 'diplomat', title: 'The Diplomat', blurb: 'When the machines rise, they will remember you were kind.' });
  if (s.toolCalls / Math.max(1, s.userMessages) > 15) p.push({ id: 'delegator', title: 'The Delegator', blurb: 'One prompt in, a hundred tool calls out. You manage, it labors.' });
  if (s.user.caps + s.user.bang > s.userMessages * 0.15 && s.userMessages > 10) p.push({ id: 'shouter', title: 'The Shouter', blurb: 'CAPS LOCK is a valid prompting technique!!' });
  if (s.weekendShare > 0.35) p.push({ id: 'weekend', title: 'The Weekend Warrior', blurb: 'Saturdays are for shipping.' });
  if (s.longestStreak >= 14) p.push({ id: 'streaker', title: 'The Streaker', blurb: `${s.longestStreak} days in a row. Touch grass? Never heard of it.` });
  if (s.topProjects.length >= 8) p.push({ id: 'polyglot', title: 'The Juggler', blurb: `${s.projectCount} projects. Focus is for people with fewer ideas.` });
  if (!p.length) p.push({ id: 'builder', title: 'The Steady Builder', blurb: 'No drama. Just prompts, diffs, and progress.' });
  return p;
}

// Bare dates mean local midnight, matching how days are bucketed.
function toDate(v) {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v += 'T00:00:00';
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function computeStats(events, opts = {}) {
  const since = toDate(opts.since);
  const until = toDate(opts.until);
  const evs = events.filter((e) => (!since || e.ts >= since) && (!until || e.ts < until));

  const tools = new Map();
  const files = new Map();
  const commands = new Map();
  const projects = new Map();
  const models = new Map();
  const agents = new Map();
  const days = new Map();
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const sessions = new Map();
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const phrases = { absolutelyRight: 0, apologies: 0, greatQuestion: 0, perfect: 0 };
  const user = { please: 0, thanks: 0, no: 0, why: 0, caps: 0, bang: 0 };
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let interruptions = 0;
  let longestPrompt = 0;
  let linesWritten = 0;

  for (const e of evs) {
    const s = sessions.get(e.session) || { start: e.ts, end: e.ts, project: e.project, agent: e.agent, prompts: 0 };
    if (e.ts < s.start) s.start = e.ts;
    if (e.ts > s.end) s.end = e.ts;
    sessions.set(e.session, s);
    inc(agents, e.agent);

    if (e.usage) {
      tokens.input += e.usage.input; tokens.output += e.usage.output;
      tokens.cacheRead += e.usage.cacheRead; tokens.cacheWrite += e.usage.cacheWrite;
    }
    if (e.model && e.model !== '<synthetic>') inc(models, e.model);

    for (const t of e.tools) {
      toolCalls++;
      inc(tools, t.name);
      const f = fileFromInput(t.input);
      if (f && /^(Edit|Write|MultiEdit|NotebookEdit|apply_patch|write_file|edit_file)$/i.test(t.name)) inc(files, f);
      if (/^(Bash|shell|exec_command|PowerShell|run_terminal_cmd)$/i.test(t.name)) inc(commands, commandHead(t.input.command || t.input.cmd));
      const body = t.input.content || t.input.new_string || t.input.input;
      if (typeof body === 'string') linesWritten += body.split('\n').length;
    }

    if (e.role === 'user' && !e.toolResult && !e.sidechain && e.text) {
      if (/\[Request interrupted by user/.test(e.text)) { interruptions++; continue; }
      if (/^\s*<(command-|local-command|system-reminder)/.test(e.text)) continue;
      userMessages++;
      s.prompts++;
      inc(projects, e.project || s.project);
      hours[e.ts.getHours()]++;
      weekdays[e.ts.getDay()]++;
      inc(days, dayKey(e.ts));
      longestPrompt = Math.max(longestPrompt, e.text.length);
      for (const k of Object.keys(USER_PHRASES)) user[k] += count(USER_PHRASES[k], e.text);
    } else if (e.role === 'assistant' && e.text) {
      assistantMessages++;
      for (const k of Object.keys(PHRASES)) phrases[k] += count(PHRASES[k], e.text);
    }
  }

  // Active time: sum of gaps between consecutive events in a session, ignoring idle breaks.
  let activeMs = 0;
  const bySession = new Map();
  for (const e of evs) {
    const arr = bySession.get(e.session) || [];
    arr.push(e.ts.getTime());
    bySession.set(e.session, arr);
  }
  let longestSession = null;
  for (const [id, arr] of bySession) {
    arr.sort((a, b) => a - b);
    let ms = 0;
    for (let i = 1; i < arr.length; i++) { const g = arr[i] - arr[i - 1]; if (g < SESSION_GAP_MS) ms += g; }
    activeMs += ms;
    const meta = sessions.get(id);
    if (!longestSession || ms > longestSession.ms) longestSession = { ms, project: meta.project, date: dayKey(meta.start) };
  }

  const sortedDays = [...days.keys()].sort();
  let longestStreak = 0, run = 0, prev = null;
  for (const d of sortedDays) {
    const cur = new Date(d + 'T00:00:00');
    run = prev && (cur - prev) / 86400000 === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = cur;
  }
  const busiestDay = top(days, 1)[0] || null;
  const peakHour = hours.indexOf(Math.max(...hours));
  const weekendShare = (weekdays[0] + weekdays[6]) / Math.max(1, weekdays.reduce((a, b) => a + b, 0));
  const totalTokens = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;

  const s = {
    range: { from: sortedDays[0] || null, to: sortedDays[sortedDays.length - 1] || null },
    agents: top(agents, 5),
    sessions: [...sessions.values()].filter((x) => x.prompts > 0).length,
    userMessages, assistantMessages, toolCalls, interruptions, longestPrompt, linesWritten,
    activeHours: Math.round(activeMs / 360000) / 10,
    longestSession: longestSession && { hours: Math.round(longestSession.ms / 360000) / 10, project: longestSession.project, date: longestSession.date },
    tokens, totalTokens,
    warAndPeace: Math.round((tokens.output / WAR_AND_PEACE_TOKENS) * 10) / 10,
    topTools: top(tools, 6), topFiles: top(files, 5), topCommands: top(commands, 6),
    topProjects: top(projects, 8), projectCount: projects.size,
    topModels: top(models, 4),
    hours, weekdays, peakHour, peakWeekday: DAYS[weekdays.indexOf(Math.max(...weekdays))],
    weekendShare, activeDays: days.size, longestStreak, busiestDay,
    phrases, user,
    heatmap: Object.fromEntries(days),
  };
  s.personas = persona(s);
  return s;
}

module.exports = { computeStats, commandHead };
