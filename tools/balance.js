#!/usr/bin/env node
// Calcola i piccoli bonus di bilanciamento (ATT e DIF) per i giochi che, con le regole attuali,
// vincerebbero meno del minimo desiderato contro un avversario a caso. Scrive data/balance.js.
// Uso: node tools/balance.js [minimo=0.22] [lotte-per-gioco=300]
// Va rilanciato quando cambiano stat, tipi o mosse.
global.window = global;
const path = require('path'), fs = require('fs'), root = path.join(__dirname, '..');
for (const f of ['games', 'stats', 'types', 'moves']) require(path.join(root, 'data', f + '.js'));
require(path.join(root, 'battle.js'));
const TARGET = +process.argv[2] || 0.22, N = +process.argv[3] || 300, MARGIN = 0.01;   // si punta un filo sopra il minimo
const MAX_BONUS = 0.35;

function measure(bonus, n) {
  window.BALANCE = bonus;
  const F = GAMES.map(g => Battle.makeFighter(g, STATS[g.id]));
  const w = F.map(() => 0), c = F.map(() => 0);
  for (let i = 0; i < F.length; i++) for (let k = 0; k < n; k++) {
    let j; do { j = Math.floor(Math.random() * F.length); } while (j === i);
    const winner = Battle.fight(F[i], F[j]).winner === 0 ? i : j;
    w[winner]++; c[i]++; c[j]++;
  }
  return F.map((_, i) => w[i] / c[i]);
}
const summary = r => { const s = [...r].sort((a, b) => a - b), q = p => (100 * s[Math.floor(p * (s.length - 1))]).toFixed(0) + '%';
  return `min ${q(0)} · p5 ${q(.05)} · p10 ${q(.1)} · mediana ${q(.5)} · p90 ${q(.9)} · max ${q(1)} · sotto ${TARGET * 100}%: ${r.filter(x => x < TARGET).length}`; };

console.log('senza bonus:   ', summary(measure({}, N)));
let bonus = {};
for (let it = 0; it < 8; it++) {
  const r = measure(bonus, N);
  GAMES.forEach((g, i) => { if (r[i] < TARGET + MARGIN) bonus[g.id] = Math.min(MAX_BONUS, (bonus[g.id] || 0) + (TARGET + MARGIN - r[i]) * 1.1); });
}
for (const id of Object.keys(bonus)) bonus[id] = Math.round(bonus[id] * 100) / 100;
const fresh = measure(bonus, N * 2);   // misura indipendente
console.log('con i bonus:   ', summary(fresh));
const list = Object.entries(bonus).filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]);
console.log(`${list.length} giochi con bonus:`, list.map(([id, b]) => `${GAMES.find(g => g.id === id).name} +${(b * 100).toFixed(0)}%`).join(', '));
fs.writeFileSync(path.join(root, 'data', 'balance.js'),
  '// Generato da tools/balance.js: bonus (frazione) ad Attacco e Difesa per i giochi che altrimenti vincerebbero troppo poco.\n' +
  'window.BALANCE=' + JSON.stringify(Object.fromEntries(list)) + ';\n');
