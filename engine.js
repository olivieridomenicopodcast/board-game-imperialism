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

  // Per ogni gioco vivo: il quadrato più grande (max MAX_COVER) interamente nel suo territorio,
  // scelto il più vicino al centro del territorio. Su quel quadrato va disegnata la copertina.
  function placements(state) {
    const groups = new Map();
    state.owner.forEach((o, i) => { if (!groups.has(o)) groups.set(o, []); groups.get(o).push(i); });
    const res = [];
    for (const [o, list] of groups) {
      let sr = 0, sc = 0;
      for (const i of list) { sr += Math.floor(i / SIZE); sc += i % SIZE; }
      const cr = sr / list.length, cc = sc / list.length;
      const mine = i => state.owner[i] === o;
      let best = null;
      for (let s = Math.min(MAX_COVER, Math.floor(Math.sqrt(list.length))); s >= 1 && !best; s--) {
        for (const i of list) {
          const r0 = Math.floor(i / SIZE), c0 = i % SIZE;
          if (r0 + s > SIZE || c0 + s > SIZE) continue;
          let ok = true;
          for (let r = r0; r < r0 + s && ok; r++) for (let c = c0; c < c0 + s; c++) if (!mine(r * SIZE + c)) { ok = false; break; }
          if (!ok) continue;
          const dist = Math.hypot(r0 + (s - 1) / 2 - cr, c0 + (s - 1) / 2 - cc);
          if (!best || dist < best.dist) best = { owner: o, r: r0, c: c0, s, dist };
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
