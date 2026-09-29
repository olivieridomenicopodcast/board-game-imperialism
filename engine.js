'use strict';
// Motore di conquista (puro, senza DOM). Ogni gioco parte proprietario della propria casella.
// Il vincitore di uno scontro assorbe TUTTE le caselle dello sconfitto, che esce dalla run.
(function (root) {
  const SIZE = 15;
  const MAX_COVER = 5; // lato massimo (in caselle) della copertina disegnata sul territorio
  const DIRS = [
    { dr: -1, dc: 0, name: 'N' }, { dr: 1, dc: 0, name: 'S' },
    { dr: 0, dc: 1, name: 'E' }, { dr: 0, dc: -1, name: 'O' },
  ];

  const rand = n => Math.floor(Math.random() * n);

  function create(n = SIZE * SIZE) {
    return { owner: Array.from({ length: n }, (_, i) => i), alive: n, turn: 0, wins: new Array(n).fill(0) };
  }

  // Esito provvisorio: 50/50. Verrà sostituito dal sistema di lotta (passo 6).
  function coinFlip(a, d) { return Math.random() < 0.5 ? a : d; }

  // Tutte le coppie (casella, direzione) che portano a un territorio di un altro proprietario.
  // Estrarre uno di questi a caso equivale a sorteggiare casella+direzione ripetendo finché è valida.
  function borders(state) {
    const out = [];
    for (let i = 0; i < state.owner.length; i++) {
      const r = Math.floor(i / SIZE), c = i % SIZE;
      for (const d of DIRS) {
        const nr = r + d.dr, nc = c + d.dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        const j = nr * SIZE + nc;
        if (state.owner[j] !== state.owner[i]) out.push({ from: i, to: j, dir: d.name });
      }
    }
    return out;
  }

  // mode 'game' (default): si sorteggia un gioco vivo con la stessa probabilità per tutti, poi un suo
  //   confine (casella+direzione) a caso: chi ha un impero grande non attacca più spesso degli altri.
  // mode 'edge': si sorteggia un confine qualsiasi della mappa: chi ha più confini attacca più spesso.
  function step(state, resolve = coinFlip, mode = 'game') {
    let pairs = borders(state);
    if (!pairs.length) return null;
    if (mode === 'game') {
      const attackers = [...new Set(pairs.map(p => state.owner[p.from]))];
      const a = attackers[rand(attackers.length)];
      pairs = pairs.filter(p => state.owner[p.from] === a);
    }
    const p = pairs[rand(pairs.length)];
    const attacker = state.owner[p.from], defender = state.owner[p.to];
    const winner = resolve(attacker, defender);
    const loser = winner === attacker ? defender : attacker;
    let gained = 0;
    for (let i = 0; i < state.owner.length; i++) {
      if (state.owner[i] === loser) { state.owner[i] = winner; gained++; }
    }
    state.alive--; state.turn++; state.wins[winner]++;
    return { turn: state.turn, from: p.from, to: p.to, dir: p.dir, attacker, defender, winner, loser, gained };
  }

  // Per ogni gioco vivo: il quadrato più grande (max MAX_COVER) interamente dentro il suo territorio.
  // Il quadrato può stare anche "a cavallo" tra due caselle (posizioni a mezza casella), così si può
  // centrare sul territorio: tra i quadrati della stessa dimensione vince quello più vicino al centro.
  function placements(state) {
    const groups = new Map();
    state.owner.forEach((o, i) => { if (!groups.has(o)) groups.set(o, []); groups.get(o).push(i); });
    const res = [];
    for (const [o, list] of groups) {
      let sr = 0, sc = 0, minR = SIZE, minC = SIZE, maxR = 0, maxC = 0;
      for (const i of list) {
        const r = Math.floor(i / SIZE), c = i % SIZE;
        sr += r; sc += c;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
      const cr = sr / list.length, cc = sc / list.length;
      const mine = (r, c) => r >= 0 && c >= 0 && r < SIZE && c < SIZE && state.owner[r * SIZE + c] === o;
      // il quadrato [r0, r0+s) x [c0, c0+s) sta nel territorio se tutte le caselle che tocca sono sue
      const fits = (r0, c0, s) => {
        for (let r = Math.floor(r0 + 1e-9); r < Math.ceil(r0 + s - 1e-9); r++)
          for (let c = Math.floor(c0 + 1e-9); c < Math.ceil(c0 + s - 1e-9); c++) if (!mine(r, c)) return false;
        return true;
      };
      let best = null;
      for (let s = Math.min(MAX_COVER, Math.floor(Math.sqrt(list.length))); s >= 1 && !best; s--) {
        for (let r0 = minR; r0 <= maxR - s + 1 + 1e-9; r0 += 0.5) {
          for (let c0 = minC; c0 <= maxC - s + 1 + 1e-9; c0 += 0.5) {
            if (!fits(r0, c0, s)) continue;
            const dist = Math.hypot(r0 + (s - 1) / 2 - cr, c0 + (s - 1) / 2 - cc);
            if (!best || dist < best.dist - 1e-9) best = { owner: o, r: r0, c: c0, s, dist };
          }
        }
      }
      res.push(best);
    }
    return res;
  }

  const api = { SIZE, MAX_COVER, create, step, borders, placements, coinFlip };
  root.Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
