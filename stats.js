'use strict';
// Statistiche: ogni campagna nuova ha un campo "stats" che si riempie a ogni sfida (danni, colpi, condizioni, territorio...).
// Le campagne senza "stats" (create prima di questa funzione) non contano: i loro danni non erano registrati.
// La Hall of Fame (hall.js) somma le statistiche di tutte le campagne con Stats.aggregate().
(function (root) {
  const SUM = ['fights', 'real', 'wins', 'losses', 'atk', 'def', 'winsAtk', 'winsDef', 'dmgDone', 'dmgTaken', 'hits', 'crits', 'supers', 'weaks',
               'misses', 'uses', 'statusIn', 'statusOut', 'skips', 'selfHits', 'absorbed', 'upsets', 'rounds', 'survSum', 'survN', 'firstOut', 'hpWinSum'];
  const MAXK = ['maxTerr', 'maxPrestige'];

  const blank = () => ({ v: 1, fights: 0, games: {}, records: {}, done: false, winner: null });
  const gs = (st, id) => st.games[id] || (st.games[id] = Object.assign(Object.fromEntries(SUM.concat(MAXK).map(k => [k, 0])), { moves: {}, rivals: {} }));
  const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const bst = f => f ? f.maxHp + f.atk + f.def + f.spd : 0;   // "stat totali", per riconoscere le vittorie a sorpresa

  // info: { ev (esito del motore), ids: [id gioco] per indice, battle|null, fighters, prestige, terr (caselle del vincitore dopo la conquista), total }
  function record(camp, info) {
    const st = camp && camp.stats;
    if (!st) return;
    const { ev, ids, battle, fighters = {}, prestige = {}, terr, total } = info;
    const A = ev.attacker, D = ev.defender, W = ev.winner, L = ev.loser;
    const gA = gs(st, ids[A]), gD = gs(st, ids[D]);
    const win = gs(st, ids[W]), lose = gs(st, ids[L]);
    st.fights++;
    gA.atk++; gD.def++; gA.fights++; gD.fights++;
    win.wins++; lose.losses++;
    if (W === A) win.winsAtk++; else win.winsDef++;
    win.absorbed += ev.gained;
    win.maxTerr = Math.max(win.maxTerr, terr || 0);
    for (const [o, g] of [[A, gA], [D, gD]]) g.maxPrestige = Math.max(g.maxPrestige, prestige[o] || 0);
    inc(gA.rivals, ids[D]); inc(gD.rivals, ids[A]);
    lose.survSum += (total > 1 ? ev.turn / (total - 1) : 1); lose.survN++;
    if (ev.turn === 1) lose.firstOut++;
    if (bst(fighters[W]) && bst(fighters[W]) < bst(fighters[L])) win.upsets++;

    if (battle && battle.events) {
      const own = [A, D], G = [gA, gD];       // lato 0 = attaccante, lato 1 = sfidante
      G[0].real++; G[1].real++;
      G[0].rounds += battle.rounds; G[1].rounds += battle.rounds;
      for (const e of battle.events) {
        const i = e.side;
        switch (e.kind) {
          case 'use': G[i].uses++; inc(G[i].moves, e.move); break;
          case 'hit':
            G[i].dmgDone += e.dmg; G[1 - i].dmgTaken += e.dmg; G[i].hits++;
            if (e.crit) G[i].crits++;
            if (e.eff === 'super') G[i].supers++; else if (e.eff === 'weak') G[i].weaks++;
            if (!st.records.biggestHit || e.dmg > st.records.biggestHit.dmg) {
              const m = battle.events.slice(0, battle.events.indexOf(e)).reverse().find(x => x.kind === 'use' && x.side === i);
              st.records.biggestHit = { dmg: e.dmg, by: ids[own[i]], vs: ids[own[1 - i]], move: m && m.move, crit: !!e.crit };
            }
            break;
          case 'miss': G[i].misses++; break;
          case 'status': G[i].statusIn++; G[1 - i].statusOut++; break;
          case 'skip': G[i].skips++; break;
          case 'self': G[i].selfHits++; G[i].dmgTaken += e.dmg; break;
          case 'dot': G[i].dmgTaken += e.dmg; break;
        }
      }
      const ws = W === A ? 0 : 1, f = fighters[W], left = f && f.maxHp ? battle.hp[ws] / f.maxHp : 0;
      win.hpWinSum += left;
      const r = st.records, pair = { a: ids[A], b: ids[D], w: ids[W] };
      if (!r.longest || battle.rounds > r.longest.rounds) r.longest = { rounds: battle.rounds, ...pair };
      if (!r.shortest || battle.rounds < r.shortest.rounds) r.shortest = { rounds: battle.rounds, ...pair };
      if (left > 0 && (!r.narrowest || left < r.narrowest.left)) r.narrowest = { left, ...pair };
    }
    if (!st.done && info.alive === 1) {
      st.done = true; st.winner = ids[W];
      win.survSum += 1; win.survN++;
    }
  }

  // Somma le statistiche di tutte le campagne che ne hanno (campagne giocate = con almeno una sfida).
  // ritorna { rows: {idGioco: riga}, records, campaigns }
  function aggregate(campaigns) {
    const rows = {}, rec = {};
    let n = 0;
    const row = id => rows[id] || (rows[id] = Object.assign(Object.fromEntries(SUM.concat(MAXK).map(k => [k, 0])),
      { camps: 0, titles: 0, bestRun: 0, moves: {}, rivals: {} }));
    for (const c of campaigns) {
      const st = c.stats;
      if (!st || !st.fights) continue;
      n++;
      for (const id of c.games) row(id).camps++;
      if (st.winner) row(st.winner).titles++;
      for (const [id, g] of Object.entries(st.games)) {
        const r = row(id);
        for (const k of SUM) r[k] += g[k] || 0;
        for (const k of MAXK) r[k] = Math.max(r[k], g[k] || 0);
        r.bestRun = Math.max(r.bestRun, g.wins || 0);
        for (const m of ['moves', 'rivals']) for (const [k, v] of Object.entries(g[m] || {})) r[m][k] = (r[m][k] || 0) + v;
      }
      const s = st.records || {};
      if (s.biggestHit && (!rec.biggestHit || s.biggestHit.dmg > rec.biggestHit.dmg)) rec.biggestHit = s.biggestHit;
      if (s.longest && (!rec.longest || s.longest.rounds > rec.longest.rounds)) rec.longest = s.longest;
      if (s.shortest && (!rec.shortest || s.shortest.rounds < rec.shortest.rounds)) rec.shortest = s.shortest;
      if (s.narrowest && (!rec.narrowest || s.narrowest.left < rec.narrowest.left)) rec.narrowest = s.narrowest;
    }
    return { rows, records: rec, campaigns: n };
  }

  root.Stats = { blank, record, aggregate, SUM, MAXK };
})(window);
