'use strict';
// Sistema di lotta automatico (puro, senza DOM). Il risultato è una lista di eventi che la
// schermata di lotta (passo 7) mostra uno alla volta.
// Dipende da: data/types.js (typeMultiplier), data/moves.js.
(function (root) {
  const CRIT_CHANCE = 0.10, CRIT_MULT = 1.5, STAB = 1.25, MAX_ROUNDS = 30;
  const SABOTAGE_MULT = 0.65, PARALYSIS_CHANCE = 0.35, CONFUSION_CHANCE = 0.33, DEBT_FRAC = 10;

  function hash(str) {                     // FNV-1a: assegnazione fissa delle mosse per gioco
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // game: {id, name}; stat: {t, hp, atk, def, spd, mt}
  function makeFighter(game, stat) {
    const tier = stat.mt !== undefined ? stat.mt : hash(game.id + '|t') % 3;
    const typeMove = { ...root.TYPE_MOVES[stat.t][tier], kind: 'type' };
    const neutral = { ...root.NEUTRAL_MOVES[hash(game.id + '|n') % root.NEUTRAL_MOVES.length], kind: 'neutral' };
    const key = root.TYPE_STATUS[stat.t][hash(game.id + '|s') % 2];
    const st = root.STATUSES[key];
    const status = { name: st.move, kind: 'status', status: key, acc: st.acc };
    const moves = [typeMove, neutral, status];
    // chi ha solo la mossa del proprio tipo più debole (potenza 55) riceve anche quella più forte del tipo
    if (tier === 0) moves.push({ ...root.TYPE_MOVES[stat.t][2], kind: 'type' });
    // piccolo bonus di bilanciamento (data/balance.js, generato da tools/balance.js) per chi resterebbe troppo in basso
    const m = 1 + ((root.BALANCE && root.BALANCE[game.id]) || 0);
    return { id: game.id, name: game.name, type: stat.t, maxHp: stat.hp, atk: Math.round(stat.atk * m), def: Math.round(stat.def * m),
             spd: stat.spd, moves, balance: (root.BALANCE && root.BALANCE[game.id]) || 0 };
  }

  const atkOf = s => s.f.atk * (s.cond && s.cond.kind === 'sabotaggio' ? SABOTAGE_MULT : 1);

  function damage(att, def, power, typeMult, stab, roll, crit) {
    const base = (22 * power * atkOf(att) / def.f.def) / 50 + 2;
    return Math.max(1, Math.floor(base * stab * typeMult * roll * crit));
  }

  function moveMult(att, def, move) {
    return move.kind === 'type' ? root.typeMultiplier(att.f.type, def.f.type) : 1;
  }

  // danno atteso (senza casualità) di una mossa che colpisce
  function expected(att, def, move) {
    const raw = damage(att, def, move.power, moveMult(att, def, move), move.kind === 'type' ? STAB : 1, 0.925, 1 + CRIT_CHANCE * (CRIT_MULT - 1));
    return raw * move.acc / 100;
  }

  const bestDamage = (att, def) => Math.max(...att.f.moves.filter(m => m.kind !== 'status').map(m => expected(att, def, m)));

  // valore di una mossa di stato: quanto danno evita o infligge nei prossimi turni
  function statusValue(att, def, move, myBest) {
    if (def.cond) return 0;
    const theirBest = bestDamage(def, att);
    const T = Math.min(5, def.hp / Math.max(myBest, 1));            // turni che restano al bersaglio
    if (T <= 1.2) return 0;                                         // sta per andare K.O.: meglio colpire
    const eff = Math.min(T, 4);
    const p = move.acc / 100;
    switch (move.status) {
      case 'paralisi':   return p * PARALYSIS_CHANCE * eff * theirBest;
      case 'sonno':      return p * Math.min(T, 2) * theirBest;
      case 'confusione': return p * 0.33 * eff * theirBest * 1.2;
      case 'sabotaggio': return p * (1 - SABOTAGE_MULT) * eff * theirBest;
      case 'debito':     return p * (def.f.maxHp / DEBT_FRAC) * eff;
      default: return 0;
    }
  }

  // IA: valuta ogni mossa e ne sceglie una a sorte, pesata sul valore (la migliore prevale ma non sempre).
  function chooseMove(att, def, rng) {
    const dmgMoves = att.f.moves.filter(m => m.kind !== 'status');
    const myBest = Math.max(...dmgMoves.map(m => expected(att, def, m)));
    const vals = att.f.moves.map(m => m.kind === 'status' ? statusValue(att, def, m, myBest) : expected(att, def, m));
    const w = vals.map(v => Math.pow(Math.max(v, 0.01), 3));
    let r = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return att.f.moves[i]; }
    return att.f.moves[0];
  }

  // fight(fa, fb) -> {winner: 0|1, rounds, events:[{side, text, hp:[a,b], ...}], hp:[a,b]}
  function fight(fa, fb, rng = Math.random) {
    const S = [{ f: fa, hp: fa.maxHp, cond: null }, { f: fb, hp: fb.maxHp, cond: null }];
    const events = [];
    const push = (side, text, extra = {}) => events.push({ side, text, hp: [S[0].hp, S[1].hp], cond: [S[0].cond && S[0].cond.kind, S[1].cond && S[1].cond.kind], ...extra });
    push(-1, `${fa.name} sfida ${fb.name}!`, { kind: 'intro' });

    // Le condizioni durano un numero di TURNI DEL BERSAGLIO (non di round): chi viene addormentato o
    // paralizzato perde davvero almeno un turno, anche se aveva già agito nel round in cui è stato colpito.
    function endCond(s, i) {
      if (!s.cond || S[0].hp <= 0 || S[1].hp <= 0) return;
      if (--s.cond.left > 0) return;
      const kind = s.cond.kind;
      push(i, kind === 'sonno' ? `${s.f.name} si sveglia!` : `${s.f.name} non è più in ${root.STATUSES[kind].label}.`, { kind: 'cure' });
      s.cond = null;
    }

    function act(i) {
      const me = S[i], foe = S[1 - i], c = me.cond;
      let lost = false;
      if (c) {
        // ultima possibilità: se paralisi/confusione non hanno ancora avuto alcun effetto, scatta al turno finale
        const forced = c.left <= 1 && !c.hit;
        if (c.kind === 'sonno') {
          push(i, `${me.f.name} dorme profondamente…`, { kind: 'skip' }); lost = true;
        } else if (c.kind === 'paralisi' && (forced || rng() < PARALYSIS_CHANCE)) {
          c.hit = true;
          push(i, `${me.f.name} è bloccato dall'Analysis Paralysis!`, { kind: 'skip' }); lost = true;
        } else if (c.kind === 'confusione' && (forced || rng() < CONFUSION_CHANCE)) {
          c.hit = true;
          const d = damage(me, me, 40, 1, 1, 0.85 + rng() * 0.15, 1);
          me.hp = Math.max(0, me.hp - d);
          push(i, `${me.f.name} è confuso dalle regole e si fa male da solo! (-${d})`, { kind: 'self', dmg: d }); lost = true;
        }
      }
      if (!lost) doMove(me, foe, i);
      endCond(me, i);
    }

    function doMove(me, foe, i) {
      const m = chooseMove(me, foe, rng);
      push(i, `${me.f.name} usa ${m.name}!`, { kind: 'use', move: m.name });
      if (rng() * 100 >= m.acc) { push(i, 'Ma manca il bersaglio!', { kind: 'miss' }); return; }
      if (m.kind === 'status') {
        if (foe.cond) { push(i, 'Ma non ha effetto!', { kind: 'fail' }); return; }
        const st = root.STATUSES[m.status];
        foe.cond = { kind: m.status, left: st.turns[0] + Math.floor(rng() * (st.turns[1] - st.turns[0] + 1)) };
        push(i, `${foe.f.name} è ora in ${st.label}!`, { kind: 'status', status: m.status });
        return;
      }
      const mult = moveMult(me, foe, m);
      const crit = rng() < CRIT_CHANCE ? CRIT_MULT : 1;
      const d = damage(me, foe, m.power, mult, m.kind === 'type' ? STAB : 1, 0.85 + rng() * 0.15, crit);
      foe.hp = Math.max(0, foe.hp - d);
      const eff = mult > 1 ? 'super' : mult < 1 ? 'weak' : null;
      push(i, `${foe.f.name} perde ${d} HP.`, { kind: 'hit', dmg: d, eff, crit: crit > 1 });
      if (crit > 1) push(i, 'Colpo critico!', { kind: 'note' });
      if (eff === 'super') push(i, "È superefficace!", { kind: 'note' });
      if (eff === 'weak') push(i, 'Non è molto efficace…', { kind: 'note' });
    }

    let round = 0;
    while (S[0].hp > 0 && S[1].hp > 0 && round < MAX_ROUNDS) {
      round++;
      const first = S[0].f.spd === S[1].f.spd ? (rng() < 0.5 ? 0 : 1) : (S[0].f.spd > S[1].f.spd ? 0 : 1);
      for (const i of [first, 1 - first]) {
        if (S[0].hp <= 0 || S[1].hp <= 0) break;
        act(i);
      }
      for (const i of [0, 1]) {                       // fine round: il debito costa HP
        const s = S[i];
        if (s.hp <= 0) continue;
        if (s.cond && s.cond.kind === 'debito') {
          const d = Math.max(1, Math.floor(s.f.maxHp / DEBT_FRAC));
          s.hp = Math.max(0, s.hp - d);
          push(i, `${s.f.name} paga la Tassa Salata! (-${d})`, { kind: 'dot', dmg: d });
        }
      }
    }
    let winner;
    if (S[0].hp <= 0 && S[1].hp <= 0) winner = rng() < 0.5 ? 0 : 1;
    else if (S[0].hp <= 0) winner = 1;
    else if (S[1].hp <= 0) winner = 0;
    else winner = (S[0].hp / S[0].f.maxHp) === (S[1].hp / S[1].f.maxHp) ? (rng() < 0.5 ? 0 : 1) : (S[0].hp / S[0].f.maxHp > S[1].hp / S[1].f.maxHp ? 0 : 1);
    push(winner, `${S[1 - winner].f.name} è K.O.!  Vince ${S[winner].f.name}!`, { kind: 'end' });
    return { winner, rounds: round, events, hp: [S[0].hp, S[1].hp] };
  }

  const api = { makeFighter, fight, hash, CRIT_CHANCE };
  root.Battle = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
