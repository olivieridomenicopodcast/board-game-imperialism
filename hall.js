'use strict';
// Hall of Fame: classifica generale di tutti i giochi, sommando le statistiche di tutte le campagne (stats.js).
// Colonne ordinabili con un clic, filtri per tipo / nome / minimo di lotte, vista per gioco o per tipo.
(function () {
  const $ = id => document.getElementById(id);
  const GAMES_BY_ID = Object.fromEntries(window.GAMES.map(g => [g.id, g]));
  const typeOf = id => (window.STATS[id] || {}).t || '';
  const per = (a, b) => (b ? a / b : 0);
  const pct = v => (v * 100).toFixed(0) + '%';
  const n0 = v => Math.round(v).toLocaleString('it-IT');
  const n1 = v => v.toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  // key, etichetta, descrizione, valore, formato
  const COLS = [
    ['camps', 'Campagne', 'Campagne giocate (con almeno una sfida)', r => r.camps, n0],
    ['titles', '🏆 Titoli', 'Campagne vinte (l\'ultimo gioco rimasto)', r => r.titles, n0],
    ['fights', 'Lotte', 'Lotte giocate', r => r.fights, n0],
    ['wins', 'Vinte', 'Lotte vinte', r => r.wins, n0],
    ['losses', 'Perse', 'Lotte perse (ogni sconfitta = eliminato dalla campagna)', r => r.losses, n0],
    ['rate', '% vittorie', 'Vittorie / lotte giocate', r => per(r.wins, r.fights), pct],
    ['winsAtk', 'V. attacco', 'Vittorie da attaccante', r => r.winsAtk, n0],
    ['winsDef', 'V. difesa', 'Vittorie da sfidato', r => r.winsDef, n0],
    ['bestRun', 'Serie max', 'Più vittorie di fila in una campagna', r => r.bestRun, n0],
    ['dmgDone', 'Danni fatti', 'Danni inflitti (lotta vera)', r => r.dmgDone, n0],
    ['dmgTaken', 'Danni subiti', 'Danni subiti, anche da condizioni e confusione', r => r.dmgTaken, n0],
    ['dmgFight', 'Danni/lotta', 'Danni fatti per lotta', r => per(r.dmgDone, r.real), n1],
    ['dmgTakenFight', 'Subiti/lotta', 'Danni subiti per lotta', r => per(r.dmgTaken, r.real), n1],
    ['crits', 'Critici', 'Colpi critici messi a segno', r => r.crits, n0],
    ['supers', 'Superefficaci', 'Colpi superefficaci', r => r.supers, n0],
    ['weaks', 'Poco eff.', 'Colpi poco efficaci', r => r.weaks, n0],
    ['misses', 'Mancati', 'Mosse andate a vuoto', r => r.misses, n0],
    ['acc', 'Precisione', 'Mosse non mancate / mosse usate', r => (r.uses ? 1 - r.misses / r.uses : 0), pct],
    ['statusIn', 'Condiz. inflitte', 'Condizioni inflitte all\'avversario', r => r.statusIn, n0],
    ['statusOut', 'Condiz. subite', 'Condizioni subite', r => r.statusOut, n0],
    ['skips', 'Turni persi', 'Turni saltati per sonno o paralisi', r => r.skips, n0],
    ['selfHits', 'Autogol', 'Colpi a sé stessi per confusione', r => r.selfHits, n0],
    ['hpWin', 'PS residui', 'Media dei PS rimasti nelle vittorie (lotta vera)', r => per(r.hpWinSum, r.wins), pct],
    ['rounds', 'Round/lotta', 'Durata media delle lotte', r => per(r.rounds, r.real), n1],
    ['absorbed', 'Assorbiti', 'Giochi assorbiti', r => r.absorbed, n0],
    ['maxTerr', 'Territorio max', 'Caselle massime raggiunte', r => r.maxTerr, n0],
    ['maxPrestige', 'Prestigio max', 'Prestigio massimo raggiunto', r => r.maxPrestige, v => '+' + (v * 100).toFixed(1) + '%'],
    ['upsets', 'Sorprese', 'Vittorie contro un avversario con stat totali più alte', r => r.upsets, n0],
    ['surv', 'Resistenza', 'Quanto arriva avanti nella campagna in media (100% = campione)', r => per(r.survSum, r.survN), pct],
    ['firstOut', 'Primo out', 'Volte eliminato alla prima sfida', r => r.firstOut, n0],
  ];
  const COLBY = Object.fromEntries(COLS.map(c => [c[0], c]));

  let data = null, mode = 'games', sort = { key: 'wins', dir: -1 };
  const filt = { q: '', type: '', min: 1 };

  function rowsFor() {
    let list;
    if (mode === 'games') {
      list = Object.entries(data.rows).map(([id, r]) => ({ id, name: GAMES_BY_ID[id] ? GAMES_BY_ID[id].name : id, type: typeOf(id), cover: GAMES_BY_ID[id] && GAMES_BY_ID[id].cover, r }));
    } else {                       // per tipo: somma le righe dei giochi dello stesso tipo
      const by = {};
      for (const [id, r] of Object.entries(data.rows)) {
        const t = typeOf(id) || '?', acc = by[t] || (by[t] = { camps: 0, titles: 0, bestRun: 0, maxTerr: 0, maxPrestige: 0, moves: {}, rivals: {}, games: 0 });
        acc.games++;
        for (const k of Stats.SUM.concat(['camps', 'titles'])) acc[k] = (acc[k] || 0) + r[k];
        for (const k of ['bestRun', 'maxTerr', 'maxPrestige']) acc[k] = Math.max(acc[k], r[k]);
      }
      const T = Object.fromEntries(window.TYPES.map(t => [t.id, t]));
      list = Object.entries(by).map(([t, r]) => ({ id: t, name: (T[t] ? T[t].icon + ' ' : '') + t + ` (${r.games})`, type: t, cover: null, r }));
    }
    const q = filt.q.trim().toLowerCase();
    return list.filter(x => x.r.fights >= filt.min && (!filt.type || x.type === filt.type) && (!q || x.name.toLowerCase().includes(q)));
  }

  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const gname = id => (GAMES_BY_ID[id] ? GAMES_BY_ID[id].name : id);

  function paint() {
    const list = rowsFor(), col = COLBY[sort.key];
    list.sort((a, b) => (col[3](b.r) - col[3](a.r)) * -sort.dir || a.name.localeCompare(b.name));
    // podio: i primi tre della colonna scelta
    const pod = $('hallPodium'); pod.textContent = '';
    list.slice(0, 3).forEach((x, i) => {
      const d = el('div', 'pod', pod);
      if (x.cover) { const im = el('img', '', d); im.src = x.cover; im.alt = ''; }
      const t = el('div', '', d);
      el('b', '', t, ['🥇', '🥈', '🥉'][i] + ' ' + x.name);
      el('small', '', t, `${col[1]}: ${col[4](col[3](x.r))}`);
    });
    // record assoluti
    const rc = $('hallRecords'); rc.textContent = ''; const R = data.records;
    const rec = (title, text) => { const d = el('div', 'rec', rc); el('b', '', d, title); d.append(text); };
    if (R.biggestHit) rec('💥 Colpo più forte', `${R.biggestHit.dmg} danni — ${gname(R.biggestHit.by)} su ${gname(R.biggestHit.vs)}${R.biggestHit.move ? ' con ' + R.biggestHit.move : ''}${R.biggestHit.crit ? ' (critico!)' : ''}`);
    if (R.longest) rec('⏳ Lotta più lunga', `${R.longest.rounds} round — ${gname(R.longest.a)} vs ${gname(R.longest.b)} (vince ${gname(R.longest.w)})`);
    if (R.shortest) rec('⚡ Lotta più breve', `${R.shortest.rounds} round — ${gname(R.shortest.a)} vs ${gname(R.shortest.b)} (vince ${gname(R.shortest.w)})`);
    if (R.narrowest) rec('😰 Vittoria per un soffio', `${gname(R.narrowest.w)} vince con solo il ${pct(R.narrowest.left)} dei PS (${gname(R.narrowest.a)} vs ${gname(R.narrowest.b)})`);

    // tabella
    const tb = $('hallTable'); tb.textContent = '';
    const head = el('tr', '', el('thead', '', tb));
    el('th', 'name', head, mode === 'games' ? 'Gioco' : 'Tipo');
    if (mode === 'games') el('th', '', head, 'Tipo');
    for (const c of COLS) {
      const th = el('th', c[0] === sort.key ? 'sorted' : '', head, c[1] + (c[0] === sort.key ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''));
      th.title = c[2];
      th.onclick = () => { sort = { key: c[0], dir: sort.key === c[0] ? -sort.dir : -1 }; paint(); };
    }
    const body = el('tbody', '', tb);
    for (const x of list) {
      const tr = el('tr', '', body), name = el('td', 'name', tr);
      if (x.cover) { const im = el('img', '', name); im.src = x.cover; im.alt = ''; im.loading = 'lazy'; }
      name.append(x.name); name.title = x.name;
      if (mode === 'games') el('td', '', tr, x.type);
      for (const c of COLS) el('td', '', tr, c[4](c[3](x.r)));
      if (mode === 'games') tr.onclick = () => detail(x);
    }
    $('hallNote').textContent = list.length ? `${list.length} ${mode === 'games' ? 'giochi' : 'tipi'} · clic su una colonna per ordinare${mode === 'games' ? ', clic su una riga per il dettaglio' : ''}.`
      : 'Nessun risultato con questi filtri.';
  }

  function detail(x) {
    const r = x.r, top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const moves = top(r.moves, 3).map(([m, k]) => `${m} (${k})`).join(', ') || '—';
    const riv = top(r.rivals, 3).map(([id, k]) => `${gname(id)} (${k})`).join(', ') || '—';
    const txt = [
      `Tipo: ${x.type} · campagne: ${r.camps} · titoli: ${r.titles}`,
      `Lotte: ${r.fights} — vinte ${r.wins}, perse ${r.losses} (${pct(per(r.wins, r.fights))})`,
      `Danni fatti ${n0(r.dmgDone)} · subiti ${n0(r.dmgTaken)} · critici ${r.crits} · superefficaci ${r.supers}`,
      `Assorbiti ${r.absorbed} · territorio max ${r.maxTerr} · prestigio max +${(r.maxPrestige * 100).toFixed(1)}%`,
      `Mosse più usate: ${moves}`, `Rivali più affrontati: ${riv}`,
    ].join('\n');
    Dialog.choose(txt, [{ label: 'Chiudi', value: null, kind: 'primary' }], x.name);
  }

  async function open() {
    const all = await Store.list();
    data = Stats.aggregate(all);
    $('menu').hidden = true; $('hallView').hidden = false;
    window.scrollTo(0, 0);
    $('hallInfo').textContent = data.campaigns ? `${data.campaigns} campagne registrate` : '';
    if (!data.campaigns) {
      for (const id of ['hallPodium', 'hallRecords', 'hallTable']) $(id).textContent = '';
      $('hallNote').textContent = 'Nessuna statistica ancora. Le statistiche si registrano dalle campagne create da questa versione in poi: crea una nuova campagna e gioca qualche sfida (con «Lotta vera» attiva).';
      return;
    }
    paint();
  }

  function init() {
    const sel = $('hallType');
    for (const t of window.TYPES) { const o = el('option', '', sel, `${t.icon} ${t.id}`); o.value = t.id; }
    $('hallBtn').onclick = open;
    $('hallBack').onclick = async () => { $('hallView').hidden = true; $('menu').hidden = false; await Menu.render(); };
    $('hallSearch').oninput = e => { filt.q = e.target.value; if (data && data.campaigns) paint(); };
    sel.onchange = () => { filt.type = sel.value; if (data && data.campaigns) paint(); };
    $('hallMin').oninput = e => { filt.min = Math.max(0, +e.target.value || 0); if (data && data.campaigns) paint(); };
    $('hallMode').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      mode = b.dataset.m;
      [...$('hallMode').children].forEach(x => x.classList.toggle('on', x === b));
      $('hallSearch').disabled = mode !== 'games';
      if (data && data.campaigns) paint();
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
