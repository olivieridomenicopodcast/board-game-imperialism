'use strict';
// Motore di conquista + lotta automatica (battle.js). Senza "Lotta vera" l'esito è 50/50.
// Partita (una campagna alla volta). Selezione: intoccabili (data/intoccabili.js) + giochi a caso.
// Le campagne si salvano da sole (storage.js) e si gestiscono dal menu (menu.js).
const { SIZE } = Engine;
const CELLS = SIZE * SIZE;
const PALETTE = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#d35400','#e84393','#7f8c8d','#2c3e50'];
const DIR_NAME = { N: 'nord', S: 'sud', E: 'est', O: 'ovest' };
const LOG_MAX = 300;
const GAME_BY_ID = Object.fromEntries(window.GAMES.map(g => [g.id, g]));

const $ = id => document.getElementById(id);
const gridEl = $('grid'), coversEl = $('covers'), infoEl = $('info'), statsEl = $('stats'), logEl = $('log');
const playBtn = $('playBtn'), stepBtn = $('stepBtn'), allBtn = $('allBtn'), speedSel = $('speedSel'), modeSel = $('modeSel'), realBattle = $('realBattle'), showBattles = $('showBattles'), drawAnim = $('drawAnim'), battleSpeed = $('battleSpeed'), battleMode = $('battleMode'), battleLogEl = $('battleLog');
const menuEl = $('menu'), gameViewEl = $('gameView'), nameBtn = $('nameBtn'), saveStateEl = $('saveState');

let games = [], colors = [], state = null, cellEls = [], timer = null, selected = null;
let cur = null;   // campagna aperta
let placementsNow = [];   // posizione delle copertine sulla mappa attualmente disegnata
let running = false, busy = false, runId = 0, drawSkip = false;

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

// Nuova campagna: sceglie i 225 giochi e i colori e la salva.
function createCampaign(name) {
  const g = pickGames();
  return Store.create(name, g.map(x => x.id), assignColors());
}

// Carica una campagna nella schermata di gioco.
function load(c) {
  stop();
  runId++; busy = false; drawSkip = true; release();
  if (BattleUI.active) BattleUI.skip();
  clearDraw();
  cur = c;
  games = c.games.map(id => GAME_BY_ID[id]);
  colors = c.colors;
  state = { owner: c.owner.slice(), alive: new Set(c.owner).size, turn: c.turn, wins: c.wins.slice() };
  selected = null;
  fighters.clear();
  lastBattle = null;
  battleLogEl.textContent = '';
  logEl.textContent = '';
  for (const ev of c.log) addLog(ev);
  nameBtn.textContent = '✏ ' + c.name;
  saveStateEl.textContent = '';
  buildGrid();
  paint();
  setButtons(true);
  infoEl.textContent = 'Tocca una casella per vedere il gioco.';
  if (state.alive === 1) finish();
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
  placementsNow = Engine.placements(state);
  for (const p of placementsNow) {
    const g = games[p.owner];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cover' + (selected === p.owner ? ' sel' : '');
    b.style.cssText = `left:${p.c * pct}%;top:${p.r * pct}%;width:${p.s * pct}%;height:${p.s * pct}%;--c:${colors[p.owner]};--s:${p.s}`;
    b.title = g.name; b.dataset.owner = p.owner;
    const img = document.createElement('img'); img.src = g.cover; img.alt = '';
    const s = document.createElement('span'); s.textContent = g.name;
    b.append(img, s);
    b.onclick = () => select(p.owner);
    coversEl.appendChild(b);
  }
  statsEl.textContent = `Giochi in vita: ${state.alive} / ${CELLS} · Scontri: ${state.turn}`;
}

function select(o) {
  if (busy) return;   // durante il sorteggio/la lotta la mappa non è selezionabile
  selected = o;
  coversEl.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  const size = state.owner.filter(x => x === o).length;
  const g = games[o];
  infoEl.textContent = '';
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colors[o];
  infoEl.append(dot, `#${g.n} ${g.name} — ${STATS[g.id].t} — territorio: ${size} caselle — scontri vinti: ${state.wins[o]} `);
  const cardBtn = document.createElement('button');
  cardBtn.type = 'button'; cardBtn.className = 'small'; cardBtn.textContent = '🃏 Scheda';
  cardBtn.onclick = () => Card.show(g.id, { territory: size, wins: state.wins[o], color: colors[o] });
  infoEl.appendChild(cardBtn);
  paint();
}

function addLog(ev) {
  const li = document.createElement('li');
  const a = games[ev.attacker].name, d = games[ev.defender].name, w = games[ev.winner].name;
  li.textContent = `#${ev.turn} ${a} attacca ${d} (confine ${DIR_NAME[ev.dir]}): vince ${w}${ev.rounds ? ` in ${ev.rounds} round` : ''}, +${ev.gained} ${ev.gained === 1 ? 'casella' : 'caselle'}`;
  li.style.borderLeftColor = colors[ev.winner];
  logEl.prepend(li);
  while (logEl.children.length > LOG_MAX) logEl.lastChild.remove();
}

const fighters = new Map();
function fighter(i) {
  if (!fighters.has(i)) fighters.set(i, Battle.makeFighter(games[i], STATS[games[i].id]));
  return fighters.get(i);
}

let lastBattle = null;
function resolve(attacker, defender) {
  lastBattle = Battle.fight(fighter(attacker), fighter(defender));
  return lastBattle.winner === 0 ? attacker : defender;
}

function showBattle() {
  battleLogEl.textContent = '';
  if (!lastBattle) return;
  for (const e of lastBattle.events) {
    const li = document.createElement('li');
    li.textContent = e.text;
    battleLogEl.appendChild(li);
  }
}

// Risolve lo scontro nel motore (lo stato cambia subito, la mappa si ridisegna a fine sfida).
function doStep() {
  lastBattle = null;
  const ev = Engine.step(state, realBattle.checked ? resolve : undefined, modeSel.value);
  if (!ev) return null;
  ev.rounds = lastBattle && lastBattle.rounds;
  cur.log.push({ turn: ev.turn, attacker: ev.attacker, defender: ev.defender, dir: ev.dir, winner: ev.winner, gained: ev.gained, rounds: ev.rounds || 0 });
  scheduleSave();
  return ev;
}

// mostra la schermata di lotta per lo scontro appena risolto (attaccante in basso a sinistra)
async function playBattleScreen(ev) {
  if (!lastBattle || !showBattles.checked) return;
  const side = i => ({ fighter: fighter(i), color: colors[i], cover: games[i].cover });
  await BattleUI.play({ a: side(ev.attacker), b: side(ev.defender), battle: lastBattle, speed: +battleSpeed.value,
                        manual: battleMode.value === 'manual', stop: running ? () => stop() : null });
}

// ---- sorteggio animato: chi attacca -> direzione -> freccia sulla mappa ----
const boardEl = $('board'), hudEl = $('hud'), hudMain = $('hudMain'), compassEl = $('compass'), arrowEl = $('arrow');
const DIRS = ['N', 'E', 'S', 'O'];
const bannerEl = $('banner');
const drawSpeedVal = () => +$('drawSpeed').value || 1;
const wait = ms => new Promise(r => (drawSkip ? r() : setTimeout(r, ms / drawSpeedVal())));
// attende ms (scalati sulla velocità del sorteggio); con hold resta fermo finché non si preme «Inizia lotta» o si tocca la scritta
let releaseWait = null;
function pause(ms, hold = false) {
  if (drawSkip) return Promise.resolve();
  return new Promise(r => { releaseWait = r; if (!hold) setTimeout(r, ms / drawSpeedVal()); });
}
function release() { if (releaseWait) { const r = releaseWait; releaseWait = null; r(); } }
const NS = 'http://www.w3.org/2000/svg';

function mark(el, cls) {
  coversEl.querySelectorAll('.' + cls).forEach(e => e.classList.remove(cls));
  if (el) el.classList.add(cls);
}

function coverCenter(owner) {
  const p = placementsNow.find(x => x.owner === owner);
  return p ? { x: p.c + p.s / 2, y: p.r + p.s / 2, s: p.s } : null;
}

function drawArrow(from, to) {
  arrowEl.textContent = '';
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  // parte dal bordo della copertina che attacca e arriva al bordo di quella attaccata
  const cut = a => (len < 2.2 ? 0 : Math.min(a.s / 2 * 0.95, len * 0.35));
  const x1 = from.x + ux * cut(from), y1 = from.y + uy * cut(from), x2 = to.x - ux * cut(to), y2 = to.y - uy * cut(to);
  const L = Math.hypot(x2 - x1, y2 - y1), head = Math.min(0.85, Math.max(0.4, L * 0.45));
  const bx = x2 - ux * head, by = y2 - uy * head;   // base della punta
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); arrowEl.appendChild(e); return e; };
  const line = (cls, w) => mk('line', { class: cls, x1, y1, x2: bx, y2: by, 'stroke-width': w, 'stroke-linecap': 'round' });
  const shadow = line('a-shadow', 0.42), main = line('a-main', 0.24);
  const pts = `${x2},${y2} ${bx - uy * head * 0.55},${by + ux * head * 0.55} ${bx + uy * head * 0.55},${by - ux * head * 0.55}`;
  const tip = mk('polygon', { class: 'a-head', points: pts });
  const Lb = Math.max(0.01, L - head);
  for (const l of [shadow, main]) { l.style.strokeDasharray = Lb; l.style.strokeDashoffset = drawSkip ? 0 : Lb; }
  tip.style.opacity = drawSkip ? 1 : 0;
  arrowEl.removeAttribute('hidden');
  if (!drawSkip) {
    void arrowEl.getBoundingClientRect();   // forza il ridisegno, poi parte la transizione
    const t = 1.0 / drawSpeedVal();
    for (const l of [shadow, main]) { l.style.transition = `stroke-dashoffset ${t}s linear`; l.style.strokeDashoffset = 0; }
    tip.style.transition = `opacity .15s linear ${t}s`; tip.style.opacity = 1;
  }
  return 600;
}

// Scritta grande a schermo: chi è stato sorteggiato (attaccante / sfidante)
function showBanner(label, owner, kind, withButton) {
  const g = games[owner], t = TYPES.find(x => x.id === STATS[g.id].t);
  $('bannerImg').src = g.cover;
  $('bannerLabel').textContent = label;
  $('bannerName').textContent = g.name;
  $('bannerType').textContent = `${t.icon} ${t.id}`;
  bannerEl.className = 'banner ' + kind;
  bannerEl.style.setProperty('--c', colors[owner]);
  $('bannerGo').hidden = !withButton;
  bannerEl.hidden = false;
}
function hideBanner() { bannerEl.hidden = true; }

function clearDraw() {
  hideBanner();
  hudEl.hidden = true;
  arrowEl.setAttribute('hidden', ''); arrowEl.textContent = '';
  coversEl.querySelectorAll('.pick, .target').forEach(e => e.classList.remove('pick', 'target'));
  compassEl.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
}

async function runDraw(ev) {
  drawSkip = false;
  const covers = [...coversEl.querySelectorAll('.cover')];
  const byOwner = o => covers.find(c => +c.dataset.owner === o);
  const atkEl = byOwner(ev.attacker), defEl = byOwner(ev.defender);
  compassEl.classList.remove('lit');
  compassEl.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
  hudEl.hidden = false;
  hudEl.scrollIntoView({ block: 'start', behavior: 'smooth' });

  // 1) chi attacca: la selezione salta di copertina in copertina rallentando, e si ferma sul sorteggiato
  hudMain.textContent = '🎲 Chi attacca?';
  const steps = Math.min(16, covers.length + 6);
  let prev = null;
  for (let i = 0; i < steps && !drawSkip; i++) {
    let el = atkEl;
    if (i < steps - 1) do { el = covers[Math.floor(Math.random() * covers.length)]; } while (el === prev && covers.length > 1);
    mark(el, 'pick'); prev = el;
    await wait(80 + i * i * 1.6);
  }
  mark(atkEl, 'pick');
  hudMain.textContent = `⚔ Attacca: ${games[ev.attacker].name}`;
  showBanner('⚔ ATTACCA', ev.attacker, 'atk');
  await pause(3500);
  hideBanner();

  // 2) direzione: la bussola gira e si ferma sulla direzione sorteggiata
  hudMain.textContent = '🧭 In che direzione?';
  compassEl.classList.add('lit');
  const k = 11 + Math.floor(Math.random() * 3), start = ((DIRS.indexOf(ev.dir) - (k - 1)) % 4 + 4) % 4;
  for (let i = 0; i < k && !drawSkip; i++) {
    compassEl.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
    compassEl.querySelector(`[data-d="${DIRS[(start + i) % 4]}"]`).classList.add('on');
    await wait(80 + i * 22);
  }
  compassEl.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
  compassEl.querySelector(`[data-d="${ev.dir}"]`).classList.add('on');
  hudMain.textContent = `🧭 Direzione: ${DIR_NAME[ev.dir]}`;
  await wait(1600);

  // 3) freccia dal gioco che attacca a quello attaccato
  const a = coverCenter(ev.attacker), d = coverCenter(ev.defender);
  if (a && d) { drawArrow(a, d); await wait(1300); }
  mark(defEl, 'target');
  hudMain.textContent = `${games[ev.attacker].name} ➜ ${games[ev.defender].name}`;
  // in modalità manuale la lotta parte solo quando premi «Inizia lotta» (tempo per commentare)
  const hold = battleMode.value === 'manual';
  showBanner('🎯 SFIDANTE', ev.defender, 'def', hold);
  await pause(4000, hold);
  hideBanner();
  await wait(300);
}
$('hudSkip').onclick = () => { drawSkip = true; hideBanner(); release(); };
$('bannerGo').onclick = e => { e.stopPropagation(); release(); };
bannerEl.addEventListener('click', () => release());   // un tocco sulla scritta passa al passo successivo

// ---- una sfida completa: sorteggio, lotta, aggiornamento della mappa ----
function refreshButtons(finished) {
  const over = finished !== undefined ? finished : state && state.alive === 1;
  stepBtn.disabled = allBtn.disabled = busy || over;
  playBtn.disabled = over || (busy && !running);
}

async function fight() {
  const my = runId;
  busy = true; refreshButtons();
  const ev = doStep();
  if (!ev) { busy = false; finish(); return null; }
  try {
    if (drawAnim.checked) await runDraw(ev);
    if (my !== runId) return null;
    await playBattleScreen(ev);
    if (my !== runId) return null;
  } finally { hudEl.hidden = true; hideBanner(); }
  clearDraw();
  addLog(ev);
  busy = false;
  paint(); showBattle();
  if (state.alive === 1) finish(); else { readyMsg(); refreshButtons(); }
  return ev;
}

function readyMsg() {
  infoEl.textContent = 'Sfida conclusa. Guarda la mappa, tocca un gioco per la scheda e premi «Prossima sfida» quando vuoi.';
}

function finish() {
  stop();
  busy = false;
  const w = state.owner[0];
  select(w);
  refreshButtons(true);
  infoEl.textContent = '';
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = colors[w];
  infoEl.append(dot, `🏆 ${games[w].name} domina la mappa dopo ${state.turn} scontri!`);
  scheduleSave();
}

function setButtons(active) { refreshButtons(!active); }

let wake = null;
function stop() {
  running = false;
  clearTimeout(timer); timer = null;
  if (wake) { const w = wake; wake = null; w(); }
  playBtn.textContent = '🔁 Auto';
  if (state) refreshButtons();
}

// Avanzamento automatico: una sfida dopo l'altra, con una pausa tra l'una e l'altra.
async function autoLoop() {
  while (running) {
    const ev = await fight();
    if (!ev || state.alive === 1 || !running) break;
    await new Promise(r => { wake = r; timer = setTimeout(r, +speedSel.value); });
  }
  if (running) stop();
}

playBtn.onclick = () => {
  if (running) return stop();
  running = true;
  playBtn.textContent = '⏸ Pausa';
  refreshButtons();
  autoLoop();
};
stepBtn.onclick = () => { if (!busy) { stop(); fight(); } };
allBtn.onclick = () => {
  if (busy) return;
  stop();
  while (state.alive > 1) { const ev = doStep(); if (!ev) break; addLog(ev); }
  paint(); finish();
};
// opzioni della barra (velocità, lotta, ecc.) ricordate tra una sessione e l'altra
for (const id of ['speedSel', 'modeSel', 'realBattle', 'showBattles', 'drawAnim', 'drawSpeed', 'battleMode', 'battleSpeed']) {
  const e = $(id), key = 'bgi.opt.' + id, box = e.type === 'checkbox';
  try {
    const v = localStorage.getItem(key);
    if (v !== null) { if (box) e.checked = v === '1'; else e.value = v; }
  } catch (err) { /* localStorage non disponibile */ }
  e.addEventListener('change', () => { try { localStorage.setItem(key, box ? (e.checked ? '1' : '0') : e.value); } catch (err) { /* ok */ } });
}

// se cambia il tipo di un gioco (dalla scheda) mosse e vantaggi cambiano: si ricreano i combattenti
window.addEventListener('typechange', () => { fighters.clear(); });

// ---- salvataggio ----
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); }

async function saveNow(manual) {
  clearTimeout(saveTimer); saveTimer = null;
  if (!cur) return;
  cur.owner = state.owner.slice();
  cur.wins = state.wins.slice();
  cur.turn = state.turn;
  cur.winner = state.alive === 1 ? games[state.owner[0]].id : null;
  cur.updated = Date.now();
  try {
    await Store.put(cur);
    Store.setLast(cur.id);
    const t = new Date(cur.updated).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    saveStateEl.textContent = `Salvato ✓ ${t}`;
    if (manual === true) Dialog.toast('Partita salvata');
  } catch (e) {
    saveStateEl.textContent = '⚠ Salvataggio non riuscito';
    Dialog.toast('Salvataggio non riuscito: ' + (e && e.message || e), 5000);
  }
}

function flushSave() { if (saveTimer) saveNow(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
window.addEventListener('pagehide', flushSave);

// ---- barra della campagna ----
$('saveBtn').onclick = () => saveNow(true);

nameBtn.onclick = async () => {
  const n = await Dialog.prompt('Nome della campagna', cur.name, 'Rinomina');
  if (!n) return;
  cur.name = n;
  nameBtn.textContent = '✏ ' + n;
  saveNow();
};

$('cloudBtn').onclick = async () => {
  if (!(await Sync.ensureConfigured())) return;
  await saveNow();
  try { if (await Sync.push(cur)) Dialog.toast('Caricata su GitHub ✓'); }
  catch (e) { Dialog.toast('GitHub: ' + e.message, 5000); }
};

$('restartBtn').onclick = async () => {
  const r = await Dialog.choose('Ricominciare da zero? I progressi di questa campagna andranno persi.', [
    { label: 'Annulla', value: null },
    { label: 'Stessa mappa', value: 'same', kind: 'danger' },
    { label: 'Nuova mappa', value: 'new', kind: 'danger' },
  ], 'Ricomincia');
  if (!r) return;
  const fresh = r === 'new' ? createCampaign(cur.name) : Store.create(cur.name, cur.games, cur.colors);
  fresh.id = cur.id; fresh.created = cur.created;
  load(fresh);
  await saveNow();
};

$('menuBtn').onclick = () => Game.leave();

// ---- API verso il menu ----
window.Game = {
  createCampaign,
  open(c) {
    load(c);
    Store.setLast(c.id);
    menuEl.hidden = true;
    gameViewEl.hidden = false;
    window.scrollTo(0, 0);
  },
  async leave() {
    stop();
    runId++; drawSkip = true; busy = false; release();
    if (BattleUI.active) BattleUI.skip();
    clearDraw();
    await saveNow();
    gameViewEl.hidden = true;
    menuEl.hidden = false;
    await Menu.render();
  },
  get current() { return cur; },
};
