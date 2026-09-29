'use strict';
// Passo 3: motore di conquista con esito 50/50 (la lotta vera arriva al passo 6).
// Selezione: intoccabili (data/intoccabili.js) + giochi a caso. Colori casuali.
const { SIZE } = Engine;
const CELLS = SIZE * SIZE;
const PALETTE = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#d35400','#e84393','#7f8c8d','#2c3e50'];
const DIR_NAME = { N: 'nord', S: 'sud', E: 'est', O: 'ovest' };
const LOG_MAX = 300;

const $ = id => document.getElementById(id);
const gridEl = $('grid'), coversEl = $('covers'), infoEl = $('info'), statsEl = $('stats'), logEl = $('log');
const playBtn = $('playBtn'), stepBtn = $('stepBtn'), allBtn = $('allBtn'), speedSel = $('speedSel'), modeSel = $('modeSel');

let games = [], colors = [], state = null, cellEls = [], timer = null, selected = null;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Colori casuali senza colori uguali adiacenti (N/S/E/O). Con 10 colori il greedy riesce sempre.
function assignColors() {
  const col = new Array(CELLS).fill(-1);
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE), c = i % SIZE, bad = new Set();
    if (r > 0) bad.add(col[i - SIZE]);
    if (c > 0) bad.add(col[i - 1]);
    col[i] = shuffle(PALETTE.map((_, k) => k)).find(k => !bad.has(k));
  }
  return col.map(k => PALETTE[k]);
}

// "1-3, 7" -> [1,2,3,7]
function parseKeep(str) {
  const out = new Set();
  for (const part of str.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    for (let n = +m[1]; n <= +(m[2] || m[1]); n++) out.add(n);
  }
  return out;
}

// Tutti gli intoccabili + giochi a caso fino a riempire la griglia.
function pickGames() {
  const keep = parseKeep(window.KEEP || '');
  const pinned = window.GAMES.filter(g => keep.has(g.n));
  const rest = shuffle(window.GAMES.filter(g => !keep.has(g.n)));
  return shuffle(pinned.concat(rest).slice(0, Math.max(CELLS, pinned.length)).slice(0, CELLS));
}

function newRun() {
  stop();
  games = pickGames();
  colors = assignColors();
  state = Engine.create(CELLS);
  selected = null;
  logEl.textContent = '';
  buildGrid();
  paint();
  setButtons(true);
  infoEl.textContent = 'Tocca una casella per vedere il gioco.';
}

function buildGrid() {
  gridEl.textContent = '';
  cellEls = games.map((g, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cell'; b.setAttribute('role', 'gridcell');
    b.onclick = () => select(state.owner[i]);
    gridEl.appendChild(b);
    return b;
  });
}

function paint() {
  cellEls.forEach((el, i) => {
    const o = state.owner[i];
    el.style.background = colors[o];
    el.title = games[o].name;
  });
  coversEl.textContent = '';
  const pct = 100 / SIZE;
  for (const p of Engine.placements(state)) {
    const g = games[p.owner];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cover' + (selected === p.owner ? ' sel' : '');
    b.style.cssText = `left:${p.c * pct}%;top:${p.r * pct}%;width:${p.s * pct}%;height:${p.s * pct}%;--c:${colors[p.owner]};--s:${p.s}`;
    b.title = g.name;
    const img = document.createElement('img'); img.src = g.cover; img.alt = '';
    const s = document.createElement('span'); s.textContent = g.name;
    b.append(img, s);
    b.onclick = () => select(p.owner);
    coversEl.appendChild(b);
  }
  statsEl.textContent = `Giochi in vita: ${state.alive} / ${CELLS} · Scontri: ${state.turn}`;
}

function select(o) {
  selected = o;
  coversEl.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  const size = state.owner.filter(x => x === o).length;
  const g = games[o];
  infoEl.textContent = '';
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colors[o];
  infoEl.append(dot, `#${g.n} ${g.name} — BGG ${g.id} — territorio: ${size} caselle — scontri vinti: ${state.wins[o]}`);
  paint();
}

function addLog(ev) {
  const li = document.createElement('li');
  const a = games[ev.attacker].name, d = games[ev.defender].name, w = games[ev.winner].name;
  li.textContent = `#${ev.turn} ${a} attacca ${d} (confine ${DIR_NAME[ev.dir]}): vince ${w}, +${ev.gained} ${ev.gained === 1 ? 'casella' : 'caselle'}`;
  li.style.borderLeftColor = colors[ev.winner];
  logEl.prepend(li);
  while (logEl.children.length > LOG_MAX) logEl.lastChild.remove();
}

function doStep() {
  const ev = Engine.step(state, undefined, modeSel.value);
  if (!ev) return false;
  addLog(ev);
  return true;
}

function finish() {
  stop();
  setButtons(false);
  const w = state.owner[0];
  select(w);
  infoEl.textContent = '';
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colors[w];
  infoEl.append(dot, `🏆 ${games[w].name} domina la mappa dopo ${state.turn} scontri!`);
}

function setButtons(active) { playBtn.disabled = stepBtn.disabled = allBtn.disabled = !active; }

function stop() { clearTimeout(timer); timer = null; playBtn.textContent = '▶ Avvia'; }

function loop() {
  if (!doStep() || state.alive === 1) { paint(); return finish(); }
  paint();
  timer = setTimeout(loop, +speedSel.value);
}

playBtn.onclick = () => {
  if (timer) return stop();
  playBtn.textContent = '⏸ Pausa';
  timer = setTimeout(loop, 0);
};
stepBtn.onclick = () => { stop(); doStep(); paint(); if (state.alive === 1) finish(); };
allBtn.onclick = () => {
  stop();
  while (state.alive > 1 && doStep()) { /* esegue tutti gli scontri */ }
  paint(); finish();
};
$('shuffleBtn').onclick = newRun;
newRun();
