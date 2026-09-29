'use strict';
// Scheda di un gioco (stile Pokédex): tipo, stat, mosse, vantaggi di tipo, dati BGG, cambio tipo.
// Card.show(gameId, { territory, wins, color })  -> contesto della campagna opzionale
(function (root) {
  const GAME_BY_ID = Object.fromEntries(root.GAMES.map(g => [g.id, g]));
  const TYPE = id => root.TYPES.find(t => t.id === id);

  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function badge(typeId, parent) {
    const t = TYPE(typeId);
    const b = h('span', 'badge', parent, `${t.icon} ${typeId}`);
    b.style.background = t.color;
    return b;
  }

  function bar(parent, label, v, max) {
    h('span', '', parent, label);
    const b = h('div', 'bar', parent); h('i', '', b).style.width = Math.min(100, v / max * 100) + '%';
    h('span', '', parent, String(v));
  }

  function chips(parent, list) {
    const box = h('div', 'chips', parent);
    for (const t of list) badge(t, box);
  }

  function section(parent, title) {
    const s = h('section', 'csec', parent);
    h('h4', '', s, title);
    return s;
  }

  function show(gameId, ctx) {
    const game = GAME_BY_ID[gameId];
    if (!game) return;
    const back = h('div', 'dlg-back', document.body);
    const close = () => { document.removeEventListener('keydown', onKey); window.removeEventListener('typechange', redraw); back.remove(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    const box = h('div', 'dlg cardwin', back);
    window.addEventListener('typechange', redraw);
    redraw();

    function redraw() {
      box.textContent = '';
      const s = root.STATS[gameId], t = TYPE(s.t), b = (root.BGG || {})[gameId];
      const fighter = Battle.makeFighter(game, s, ctx && ctx.prestige || 0);

      const head = h('div', 'chead', box);
      const img = h('img', '', head); img.src = game.cover; img.alt = '';
      const ht = h('div', '', head);
      h('h3', '', ht, `#${game.n} ${game.name}`);
      const line = h('div', '', ht);
      badge(s.t, line);
      if (TypeOverrides.isChanged(gameId)) h('small', 'dim', line, ` (originale: ${TypeOverrides.original(gameId)})`);
      if (window.KEEP && parseKeep(window.KEEP).has(game.n)) h('div', 'dim', ht, '★ Intoccabile: sempre in mappa');
      if (s.est) h('div', 'dim', ht, `Dati stimati: ${s.est.join(', ')}`);
      h('div', 'dim', ht, t.hint);

      if (ctx && ctx.titles) h('div', 'dim', ht, `👑 ${ctx.titles} ${ctx.titles === 1 ? 'titolo' : 'titoli'} nelle campagne ${ctx.grid}×${ctx.grid}${ctx.champ ? ' — campione in carica' : ''}`);

      if (ctx) {
        const sc = section(box, 'In campagna');
        const dot = h('span', 'dot', sc); dot.style.background = ctx.color;
        sc.append(` territorio: ${ctx.territory} ${ctx.territory === 1 ? 'casella' : 'caselle'} · scontri vinti: ${ctx.wins}`);
        if (ctx.prestige > 0.0005) h('div', 'dim', sc, `⭐ Prestigio +${Math.round(ctx.prestige * 100)}% ad Attacco e Difesa (ha assorbito ${ctx.territory - 1} giochi; massimo +${Math.round(Engine.PRESTIGE_MAX * 100)}%). Le barre mostrano già il bonus.`);
      }

      if (fighter.balance) {
        const bl = h('div', 'dim', box);
        bl.textContent = `⚖ Bonus di bilanciamento: +${Math.round(fighter.balance * 100)}% ad Attacco e Difesa (calcolato dalle simulazioni)`;
      }
      const st = section(box, 'Statistiche');
      const bars = h('div', 'bars', st);
      bar(bars, 'HP', s.hp, 170); bar(bars, 'ATT', fighter.atk, 110); bar(bars, 'DIF', fighter.def, 115); bar(bars, 'VEL', s.spd, 110);

      const mv = section(box, 'Mosse');
      const ul = h('ul', 'moves', mv);
      for (const m of fighter.moves) {
        const li = h('li', '', ul);
        if (m.kind === 'status') {
          const info = root.STATUSES[m.status];
          h('b', '', li, m.name);
          li.append(` — stato «${info.label}» (${m.acc}%): ${info.note}`);
        } else {
          h('b', '', li, m.name);
          li.append(m.kind === 'type' ? ` — tipo ${s.t}, potenza ${m.power}, precisione ${m.acc}%` : ` — neutra, potenza ${m.power}, precisione ${m.acc}%`);
        }
      }

      const ch = section(box, 'Vantaggi di tipo');
      h('div', 'dim', ch, 'Forte contro (×1.5):');
      chips(ch, root.TYPE_BEATS[s.t]);
      h('div', 'dim', ch, 'Debole contro (×0.67):');
      chips(ch, root.TYPES.map(x => x.id).filter(x => root.TYPE_BEATS[x].includes(s.t)));

      if (b) {
        const d = section(box, 'Dati BoardGameGeek');
        const rows = [
          ['Rating', b.rating ? b.rating.toFixed(2) : '—'], ['Peso', b.weight ? b.weight.toFixed(2) + ' / 5' : '—'],
          ['Durata', b.playTime ? b.playTime + ' min' : '—'],
          ['Giocatori', b.minPlayers ? (b.minPlayers === b.maxPlayers ? b.minPlayers : `${b.minPlayers}-${b.maxPlayers || '?'}`) : '—'],
          ['Anno', b.year || '—'], ['Età', b.minAge ? b.minAge + '+' : '—'],
        ];
        const grid = h('div', 'kv', d);
        for (const [k, v] of rows) { h('span', 'dim', grid, k); h('span', '', grid, String(v)); }
        if (b.categories.length) h('div', 'small', d, 'Categorie: ' + b.categories.slice(0, 8).join(', '));
        if (b.mechanics.length) h('div', 'small', d, 'Meccaniche: ' + b.mechanics.slice(0, 8).join(', '));
        const a = h('a', 'small', d, `Apri su BoardGameGeek (id ${b.bggId})`);
        a.href = `https://boardgamegeek.com/boardgame/${b.bggId}`; a.target = '_blank'; a.rel = 'noopener';
      }

      const row = h('div', 'dlg-btns', box);
      const chg = h('button', 'dlg-btn primary', row, '🔁 Cambia tipo'); chg.type = 'button';
      chg.onclick = async () => {
        const buttons = root.TYPES.map(x => ({ label: `${x.icon} ${x.id}${x.id === s.t ? ' ✓' : ''}`, value: x.id }));
        if (TypeOverrides.isChanged(gameId)) buttons.push({ label: `↺ Ripristina (${TypeOverrides.original(gameId)})`, value: '__reset', kind: '' });
        buttons.push({ label: 'Annulla', value: null });
        const r = await Dialog.choose(`Che tipo deve avere «${game.name}»? Cambiano mosse e vantaggi.`, buttons, 'Cambia tipo');
        if (!r) return;
        if (r === '__reset') TypeOverrides.clear(gameId); else TypeOverrides.set(gameId, r);
        Dialog.toast('Tipo aggiornato');
      };
      const x = h('button', 'dlg-btn', row, 'Chiudi'); x.type = 'button'; x.onclick = close;
    }
  }

  function parseKeep(str) {
    const out = new Set();
    for (const part of str.split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (m) for (let n = +m[1]; n <= +(m[2] || m[1]); n++) out.add(n);
    }
    return out;
  }

  root.Card = { show };
})(window);
