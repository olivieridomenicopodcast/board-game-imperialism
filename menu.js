'use strict';
// Menu principale: elenco delle campagne e relative azioni.
(function () {
  const $ = id => document.getElementById(id);
  const listEl = $('campaigns'), continueBtn = $('continueBtn');

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  const fmtDate = ts => new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const gameName = (c, idx) => { const g = window.GAMES.find(x => x.id === c.games[idx]); return g ? g.name : '?'; };

  // miniatura della mappa: un pixel-blocco per casella, del colore del proprietario
  function thumb(c) {
    const S = 15, px = 3, cv = document.createElement('canvas');
    cv.width = cv.height = S * px; cv.className = 'thumb';
    const g = cv.getContext('2d');
    c.owner.forEach((o, i) => { g.fillStyle = c.colors[o]; g.fillRect((i % S) * px, Math.floor(i / S) * px, px, px); });
    return cv;
  }

  function download(filename, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const safeName = s => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'campagna';

  async function nameFor(base) {
    const all = await Store.list();
    let n = 1;
    while (all.some(c => c.name === `${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  // salva una campagna proveniente da fuori (file/GitHub); se l'id esiste già chiede cosa fare
  async function adopt(c) {
    const err = Store.validate(c);
    if (err) { Dialog.toast(err, 5000); return false; }
    const existing = await Store.get(c.id);
    if (existing) {
      const r = await Dialog.choose(`Esiste già una campagna «${existing.name}» con questo salvataggio (aggiornata ${fmtDate(existing.updated)}). Cosa faccio?`, [
        { label: 'Annulla', value: null },
        { label: 'Tieni entrambe', value: 'copy' },
        { label: 'Sovrascrivi', value: 'over', kind: 'danger' },
      ], 'Campagna già presente');
      if (!r) return false;
      if (r === 'copy') { c = { ...c, id: Store.uid(), name: c.name + ' (copia)' }; }
    }
    await Store.put(c);
    return true;
  }

  async function render() {
    const all = await Store.list();
    listEl.textContent = '';
    const last = all.find(c => c.id === Store.lastId()) || all[0];
    continueBtn.disabled = !last;
    continueBtn.textContent = last ? `▶ Continua: ${last.name}` : '▶ Continua';
    continueBtn.onclick = () => last && Game.open(last);
    $('storageNote').textContent = `Salvataggio automatico su questo dispositivo (${Store.storageKind}). Per non perderli, usa Esporta o ☁ GitHub.`;

    if (!all.length) {
      el('p', 'empty', listEl, 'Nessuna campagna. Premi «Nuova campagna» per iniziare!');
      return;
    }
    for (const c of all) {
      const p = Store.progress(c);
      const card = el('div', 'camp', listEl);
      card.appendChild(thumb(c));
      const info = el('div', 'campinfo', card);
      el('h3', '', info, c.name);
      const finished = p.alive === 1;
      el('div', 'campmeta', info, finished
        ? `🏆 Vincitore: ${gameName(c, c.owner[0])} · ${c.turn} scontri`
        : `In vita ${p.alive}/${p.total} · ${c.turn} scontri`);
      el('div', 'campmeta dim', info, `Ultimo salvataggio: ${fmtDate(c.updated)}`);
      const row = el('div', 'campbtns', info);
      const btn = (label, title, fn, cls) => {
        const b = el('button', cls || 'ghost small', row, label);
        b.type = 'button'; b.title = title; b.onclick = e => { e.stopPropagation(); fn(); };
        return b;
      };
      btn(finished ? '👁 Rivedi' : '▶ Gioca', 'Apri la campagna', () => Game.open(c), 'small');
      btn('✏', 'Rinomina', async () => {
        const n = await Dialog.prompt('Nome della campagna', c.name, 'Rinomina');
        if (!n) return;
        c.name = n; c.updated = Date.now(); await Store.put(c); render();
      });
      btn('⧉', 'Duplica (ottimo per provare strade diverse)', async () => {
        const copy = JSON.parse(JSON.stringify(c));
        copy.id = Store.uid(); copy.name = c.name + ' (copia)'; copy.created = copy.updated = Date.now();
        await Store.put(copy); render(); Dialog.toast('Campagna duplicata');
      });
      btn('⬇', 'Esporta in un file', () => download(`bgi-${safeName(c.name)}.json`, JSON.stringify(c)));
      btn('☁', 'Carica su GitHub', async () => {
        if (!(await Sync.ensureConfigured())) return;
        try { if (await Sync.push(c)) Dialog.toast('Caricata su GitHub ✓'); }
        catch (e) { Dialog.toast('GitHub: ' + e.message, 5000); }
      });
      btn('🗑', 'Elimina', async () => {
        const ok = await Dialog.confirm(`Sei sicuro di voler cancellare «${c.name}»? Non si può annullare.`, { okLabel: 'Cancella', danger: true, title: 'Elimina campagna' });
        if (!ok) return;
        await Store.remove(c.id);
        render(); Dialog.toast('Campagna cancellata');
      }, 'ghost small danger');
      card.onclick = () => Game.open(c);
    }
  }

  $('newBtn').onclick = async () => {
    const n = await Dialog.prompt('Nome della nuova campagna', await nameFor('Campagna'), 'Nuova campagna');
    if (!n) return;
    const c = Game.createCampaign(n);
    await Store.put(c);
    Game.open(c);
  };

  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let c;
    try { c = JSON.parse(await file.text()); } catch (err) { Dialog.toast('File non leggibile.', 4000); return; }
    if (await adopt(c)) { await render(); Dialog.toast('Campagna importata'); }
  };

  $('syncCfgBtn').onclick = async () => { if (await Sync.configure()) Dialog.toast('Impostazioni GitHub salvate'); };

  $('pullBtn').onclick = async () => {
    if (!(await Sync.ensureConfigured())) return;
    let remote;
    try { Dialog.toast('Cerco le campagne su GitHub…'); remote = await Sync.list(); }
    catch (e) { Dialog.toast('GitHub: ' + e.message, 5000); return; }
    if (!remote.length) { Dialog.toast('Nessuna campagna trovata su GitHub.', 4000); return; }
    // scelta: una alla volta, dalla più recente
    const buttons = remote.slice(0, 6).map(c => ({ label: `${c.name} (${fmtDate(c.updated)})`, value: c.id }));
    const id = await Dialog.choose('Quale campagna vuoi scaricare?', [{ label: 'Annulla', value: null }, ...buttons], 'Scarica da GitHub');
    if (!id) return;
    if (await adopt(remote.find(c => c.id === id))) { await render(); Dialog.toast('Campagna scaricata'); }
  };

  window.Menu = { render };
  Store.init().then(render);
})();
