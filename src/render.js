'use strict';

const REPO = 'https://github.com/alibnelsayed/agent-wrapped';

function renderHTML(stats, opts = {}) {
  const data = JSON.stringify({ ...stats, title: opts.title || 'Agent Wrapped', repo: REPO }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Wrapped</title>
<style>
:root{--fg:#fff;--muted:rgba(255,255,255,.72);--card:rgba(255,255,255,.1)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#0b0b10;color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
#stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.slide{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;padding:72px max(24px,calc(50vw - 300px)) 56px;transition:opacity .4s}
.slide.on{display:flex;animation:in .55s cubic-bezier(.2,.8,.2,1)}
@keyframes in{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
.kicker{font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;font-weight:600}
h1{font-size:clamp(40px,9vw,84px);line-height:.95;font-weight:900;letter-spacing:-.03em}
h2{font-size:clamp(28px,6vw,48px);line-height:1.05;font-weight:850;letter-spacing:-.02em;margin-bottom:18px}
.big{font-size:clamp(64px,18vw,160px);font-weight:900;line-height:.9;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
p.sub{font-size:clamp(17px,3.2vw,22px);color:var(--muted);margin-top:16px;line-height:1.4}
.row{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
.pill{background:var(--card);border-radius:999px;padding:10px 16px;font-weight:650;font-size:15px;backdrop-filter:blur(6px)}
.bars{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.bar{position:relative;background:var(--card);border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;font-weight:700;overflow:hidden;font-size:17px}
.bar i{position:absolute;inset:0 auto 0 0;background:rgba(255,255,255,.22);border-radius:12px;transform-origin:left;animation:grow 1s cubic-bezier(.2,.8,.2,1) both}
.bar span{position:relative;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%}.bar b{position:relative;font-variant-numeric:tabular-nums}
@keyframes grow{from{transform:scaleX(0)}}
.hours{display:flex;align-items:flex-end;gap:3px;height:140px;margin-top:18px}
.hours div{flex:1;background:rgba(255,255,255,.35);border-radius:4px 4px 0 0;min-height:2px;animation:up .9s cubic-bezier(.2,.8,.2,1) both;transform-origin:bottom}
.hours div.peak{background:#fff}
@keyframes up{from{transform:scaleY(0)}}
.axis{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px}
.heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);gap:3px;margin-top:16px;overflow:hidden}
.heat div{width:100%;aspect-ratio:1;border-radius:3px;background:rgba(255,255,255,.08)}
#progress{position:fixed;top:14px;left:max(16px,calc(50vw - 300px));right:max(16px,calc(50vw - 300px));display:flex;gap:4px;z-index:5}
#progress span{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.25);overflow:hidden}
#progress span.done{background:#fff}
#hint{position:fixed;bottom:16px;width:100%;text-align:center;font-size:13px;color:var(--muted);z-index:5}
.btn{display:inline-block;background:#fff;color:#111;border:0;border-radius:999px;padding:14px 22px;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none;margin:8px 8px 0 0}
.btn.ghost{background:var(--card);color:#fff}
canvas{width:100%;max-width:420px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.4);margin-top:8px;align-self:flex-start}
.emoji{font-size:56px;margin-bottom:12px}
.g0{background:radial-gradient(120% 90% at 10% 0%,#ff4f8b 0%,#7b2ff7 45%,#120a2a 100%)}
.g1{background:radial-gradient(120% 90% at 90% 0%,#00d2a8 0%,#0a6cff 50%,#06142e 100%)}
.g2{background:radial-gradient(120% 90% at 0% 100%,#ffb800 0%,#ff5f1f 45%,#2a0b05 100%)}
.g3{background:radial-gradient(120% 90% at 100% 100%,#b6f500 0%,#11998e 50%,#04201c 100%)}
.g4{background:radial-gradient(120% 90% at 50% 0%,#ff7ad9 0%,#5d3cff 55%,#0b0726 100%)}
.g5{background:radial-gradient(120% 90% at 0% 0%,#3b3b3b 0%,#111 60%,#000 100%)}
.g6{background:radial-gradient(120% 90% at 80% 20%,#ff3d3d 0%,#a0005a 50%,#1a0010 100%)}
.g7{background:radial-gradient(120% 90% at 20% 80%,#00e5ff 0%,#6a00ff 55%,#0a0020 100%)}
</style>
</head>
<body>
<div id="progress"></div>
<div id="stage"></div>
<div id="hint">tap or press → to continue</div>
<script>
const S = ${data};
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e4 ? (n/1e3).toFixed(1)+'K' : Number(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hour12 = (h) => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
const bars = (list) => { const max = Math.max(1, ...list.map((x) => x.value)); return '<div class="bars">' + list.map((x, i) => '<div class="bar"><i style="width:' + (x.value / max * 100) + '%;animation-delay:' + (i * 90) + 'ms"></i><span>' + esc(x.name) + '</span><b>' + fmt(x.value) + '</b></div>').join('') + '</div>'; };
const agentNames = { 'claude-code': 'Claude Code', codex: 'Codex' };
const persona = S.personas[0];

const slides = [];
const add = (g, html, when = true) => { if (when) slides.push({ g, html }); };

add('g0', '<div class="kicker">' + esc(S.range.from || '') + ' → ' + esc(S.range.to || '') + '</div><h1>Your year<br>with AI agents.</h1><p class="sub">' + S.agents.map((a) => esc(agentNames[a.name] || a.name)).join(' + ') + '. Every prompt. Every tool call. All counted on your own machine.</p>');
add('g1', '<div class="kicker">You talked to your agent</div><div class="big" data-count="' + S.userMessages + '">0</div><p class="sub">times, across <b>' + fmt(S.sessions) + '</b> sessions and <b>' + S.activeHours + '</b> hours of actual pairing.</p>' + (S.longestSession && S.longestSession.hours ? '<div class="row"><span class="pill">Longest session: ' + S.longestSession.hours + 'h on ' + esc(S.longestSession.project || 'a project') + '</span></div>' : ''));
add('g2', '<div class="kicker">Tokens burned</div><div class="big" data-count="' + S.totalTokens + '" data-fmt="1">0</div><p class="sub">Your agent wrote <b>' + fmt(S.tokens.output) + '</b> tokens of output. That is ' + (S.warAndPeace >= 1 ? '<b>' + S.warAndPeace + '×</b> the length of <i>War and Peace</i>.' : 'about <b>' + Math.round(S.warAndPeace * 100) + '%</b> of <i>War and Peace</i>.') + '</p><div class="row"><span class="pill">' + fmt(S.tokens.cacheRead) + ' read from cache</span><span class="pill">' + fmt(S.tokens.input) + ' fresh input</span></div>', S.totalTokens > 0);
add('g3', '<div class="kicker">' + fmt(S.toolCalls) + ' tool calls</div><h2>Its favorite moves</h2>' + bars(S.topTools), S.topTools.length);
add('g4', '<div class="kicker">The files you could not leave alone</div><h2>' + esc(S.topFiles[0] && S.topFiles[0].name) + '</h2><p class="sub" style="margin:-8px 0 18px">was edited <b>' + fmt(S.topFiles[0] && S.topFiles[0].value) + '</b> times. Is it okay?</p>' + bars(S.topFiles), S.topFiles.length);
add('g5', '<div class="kicker">Terminal greatest hits</div><h2 style="font-family:ui-monospace,Menlo,Consolas,monospace">$ ' + esc(S.topCommands[0] && S.topCommands[0].name) + '</h2>' + bars(S.topCommands), S.topCommands.length);
add('g7', '<div class="kicker">Peak hour</div><h1>' + hour12(S.peakHour) + '</h1><p class="sub">is when you and your agent are most in sync. ' + esc(S.peakWeekday) + 's are your busiest day.</p><div class="hours">' + S.hours.map((v, i) => '<div class="' + (i === S.peakHour ? 'peak' : '') + '" style="height:' + (v / Math.max(1, ...S.hours) * 100) + '%;animation-delay:' + (i * 25) + 'ms"></div>').join('') + '</div><div class="axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>');
add('g1', '<div class="kicker">' + S.activeDays + ' active days</div><h2>Longest streak: ' + S.longestStreak + ' day' + (S.longestStreak === 1 ? '' : 's') + '</h2><div class="heat" id="heat"></div>' + (S.busiestDay ? '<p class="sub">Busiest day: <b>' + esc(S.busiestDay.name) + '</b> with ' + S.busiestDay.value + ' prompts.</p>' : ''));
add('g6', '<div class="emoji">🫡</div><div class="kicker">Your agent said “You\\'re absolutely right”</div><div class="big" data-count="' + S.phrases.absolutelyRight + '">0</div><p class="sub">times. It also apologized <b>' + S.phrases.apologies + '</b> times and called something a “great question” <b>' + S.phrases.greatQuestion + '</b> times.</p>');
add('g2', '<div class="kicker">Your manners report</div><h2>You said “please” ' + fmt(S.user.please) + ' times<br>and “thanks” ' + fmt(S.user.thanks) + '.</h2><div class="row"><span class="pill">⛔ Interrupted it ' + fmt(S.interruptions) + '×</span><span class="pill">🤔 Asked “why” ' + fmt(S.user.why) + '×</span><span class="pill">🙅 Started with “no” ' + fmt(S.user.no) + '×</span><span class="pill">📣 ' + fmt(S.user.caps + S.user.bang) + ' moments of SHOUTING!!</span></div>');
add('g3', '<div class="kicker">' + S.projectCount + ' projects</div><h2>Where the magic happened</h2>' + bars(S.topProjects.slice(0, 5)), S.topProjects.length);
add('g4', '<div class="kicker">Your agent personality</div><h1>' + esc(persona.title) + '</h1><p class="sub">' + esc(persona.blurb) + '</p>' + (S.personas.length > 1 ? '<div class="row">' + S.personas.slice(1).map((p) => '<span class="pill">also: ' + esc(p.title) + '</span>').join('') + '</div>' : ''));
add('g0', '<div class="kicker">Share your Wrapped</div><canvas id="card" width="1080" height="1350"></canvas><div><button class="btn" id="dl">Download image</button><a class="btn ghost" id="share" target="_blank" rel="noopener">Share on X</a></div>');

const stage = document.getElementById('stage');
const prog = document.getElementById('progress');
slides.forEach((s, i) => {
  const el = document.createElement('section');
  el.className = 'slide ' + s.g; el.innerHTML = s.html; stage.appendChild(el);
  prog.appendChild(document.createElement('span'));
});
let cur = -1;
function countUp(el) {
  const target = +el.dataset.count, useFmt = el.dataset.fmt, t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / 1200), v = Math.round(target * (1 - Math.pow(1 - k, 3))); el.textContent = useFmt ? fmt(v) : v.toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === cur) return;
  cur = i;
  [...stage.children].forEach((el, j) => el.classList.toggle('on', j === i));
  [...prog.children].forEach((el, j) => el.classList.toggle('done', j <= i));
  stage.children[i].querySelectorAll('[data-count]').forEach(countUp);
  document.getElementById('hint').style.display = i === slides.length - 1 ? 'none' : '';
  if (stage.children[i].querySelector('#heat')) drawHeat();
  if (stage.children[i].querySelector('#card')) drawCard();
}
document.addEventListener('keydown', (e) => { if (['ArrowRight', ' ', 'Enter'].includes(e.key)) go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
stage.addEventListener('click', (e) => { if (e.target.closest('button,a,canvas')) return; go(e.clientX < innerWidth / 3 ? cur - 1 : cur + 1); });

function drawHeat() {
  const el = document.getElementById('heat'); if (el.childElementCount) return;
  const keys = Object.keys(S.heatmap).sort(); if (!keys.length) return;
  const end = new Date(keys[keys.length - 1] + 'T00:00:00'); const start = new Date(end); start.setDate(start.getDate() - 7 * 26 + 1); start.setDate(start.getDate() - start.getDay());
  const max = Math.max(...Object.values(S.heatmap));
  let cols = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const v = S.heatmap[k] || 0; const c = document.createElement('div');
    if (v) c.style.background = 'rgba(255,255,255,' + (0.25 + 0.75 * v / max) + ')';
    c.title = k + ': ' + v; el.appendChild(c); if (d.getDay() === 0) cols++;
  }
  el.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
}

function drawCard() {
  const c = document.getElementById('card'), x = c.getContext('2d'), W = c.width, H = c.height;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff4f8b'); g.addColorStop(.5, '#7b2ff7'); g.addColorStop(1, '#0a6cff');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(60, 60, W - 120, H - 120);
  x.fillStyle = '#fff'; x.textBaseline = 'top';
  const font = (w, s) => w + ' ' + s + 'px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  x.font = font(800, 34); x.globalAlpha = .8; x.fillText('AGENT WRAPPED ' + (S.range.to || '').slice(0, 4), 110, 110); x.globalAlpha = 1;
  x.font = font(900, 84); x.fillText(persona.title, 110, 170, W - 220);
  const cells = [
    ['Prompts', fmt(S.userMessages)], ['Tokens', fmt(S.totalTokens)],
    ['Tool calls', fmt(S.toolCalls)], ['Hours paired', String(S.activeHours)],
    ['Peak hour', hour12(S.peakHour)], ['Streak', S.longestStreak + ' days'],
    ['Top tool', (S.topTools[0] || {}).name || '-'], ['"Absolutely right"', fmt(S.phrases.absolutelyRight) + '×'],
  ];
  cells.forEach(([k, v], i) => {
    const cx = 110 + (i % 2) * 440, cy = 330 + Math.floor(i / 2) * 210;
    x.globalAlpha = .75; x.font = font(700, 30); x.fillText(k, cx, cy); x.globalAlpha = 1;
    x.font = font(900, 72); x.fillText(String(v), cx, cy + 44, 400);
  });
  x.globalAlpha = .85; x.font = font(700, 30); x.fillText('npx agent-wrapped', 110, H - 150); x.globalAlpha = 1;
  document.getElementById('dl').onclick = () => { const a = document.createElement('a'); a.download = 'agent-wrapped.png'; a.href = c.toDataURL('image/png'); a.click(); };
  const text = 'My AI coding agent said "You\\'re absolutely right" ' + S.phrases.absolutelyRight + ' times this year. I sent ' + fmt(S.userMessages) + ' prompts and burned ' + fmt(S.totalTokens) + ' tokens.\\n\\nI am ' + persona.title + '. What are you?\\n\\nnpx agent-wrapped #AgentWrapped';
  document.getElementById('share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(S.repo);
}
go(0);
</script>
</body>
</html>`;
}

module.exports = { renderHTML };
