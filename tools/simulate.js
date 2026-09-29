#!/usr/bin/env node
// Simula tante lotte tra giochi a caso per calibrare il sistema di lotta.
// Uso: node tools/simulate.js [lotte-per-gioco]
global.window = global;
const path = require('path'), root = path.join(__dirname, '..');
for (const f of ['games', 'stats', 'types', 'moves', 'balance']) require(path.join(root, 'data', f + '.js'));
require(path.join(root, 'battle.js'));
const N = +process.argv[2] || 200;
const F = GAMES.map(g => Battle.makeFighter(g, STATS[g.id]));
const wins = F.map(() => 0), fights = F.map(() => 0);
let rounds = 0, total = 0;
const byType = {};
for (let i = 0; i < F.length; i++) for (let k = 0; k < N; k++) {
  let j; do { j = Math.floor(Math.random() * F.length); } while (j === i);
  const r = Battle.fight(F[i], F[j]);
  rounds += r.rounds; total++;
  const w = r.winner === 0 ? i : j;
  wins[w]++; fights[i]++; fights[j]++;
}
const rate = F.map((_, i) => wins[i] / fights[i]);
const sorted = [...rate].sort((a, b) => a - b), q = p => sorted[Math.floor(p * (sorted.length - 1))];
console.log('lotte:', total, ' round medi:', (rounds / total).toFixed(1));
console.log('win rate per gioco vs avversario a caso  min %s  p10 %s  mediana %s  p90 %s  max %s',
  ...[0, .1, .5, .9, 1].map(p => (100 * q(p)).toFixed(0) + '%'));
// upset: coppie con win rate molto diverso, quanto spesso vince il più debole?
const order = rate.map((r, i) => i).sort((a, b) => rate[a] - rate[b]);
const top = order.slice(-60), bot = order.slice(0, 60);
let up = 0, n = 0;
for (const b of bot) for (const t of top) for (let k = 0; k < 20; k++) { n++; const r = Battle.fight(F[b], F[t]); if (r.winner === 0) up++; }
console.log('top 60 vs bottom 60: il più debole vince il %s% delle volte', (100 * up / n).toFixed(0));
const tt = {}; F.forEach((f, i) => { (tt[f.type] = tt[f.type] || []).push(rate[i]); });
console.log('win rate medio per tipo:', Object.entries(tt).map(([t, l]) => `${t} ${(100 * l.reduce((a, b) => a + b) / l.length).toFixed(0)}%`).join(', '));
const nm = i => `${F[i].name} (${F[i].type}) ${(100 * rate[i]).toFixed(0)}%`;
console.log('più forti:', order.slice(-6).reverse().map(nm).join('; '));
console.log('più deboli:', order.slice(0, 6).map(nm).join('; '));
