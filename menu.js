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
    const S = Math.round(Math.sqrt(c.owner.length)), px = Math.max(1, Math.floor(90 / S)), cv = document.createElement('canvas');
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
      if (r === 'copy') { c = { ...c, id: Store.uid(), name: c.name + ' (copia)', stats: c.stats ? Stats.blank() : undefined }; }
    }
    await Store.put(c);
    return true;
  }

  async function render() {
    const all = await Store.list();
    updateSyncBar();
    listEl.textContent = '';
    const last = all.find(c => c.id === Store.lastId()) || all[0];
    continueBtn.disabled = !last;
    continueBtn.textContent = last ? `▶ Continua: ${last.name}` : '▶ Continua';
    continueBtn.onclick = () => last && Game.open(last);
    $('storageNote').textContent = `Salvataggio automatico su questo dispositivo (${Store.storageKind}). Per non perderli usa ⬆ Push (GitHub) oppure Esporta.`;

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
        if (copy.stats) copy.stats = Stats.blank();   // la copia parte da zero: così le sfide già giocate non si contano due volte
        await Store.put(copy); render(); Dialog.toast('Campagna duplicata');
      });
      btn('⬇', 'Esporta in un file', () => download(`bgi-${safeName(c.name)}.json`, JSON.stringify(c)));
      btn('🗑', 'Elimina', async () => {
        const ok = await Dialog.confirm(`Sei sicuro di voler cancellare «${c.name}»? Non si può annullare.`, { okLabel: 'Cancella', danger: true, title: 'Elimina campagna' });
        if (!ok) return;
        await Store.remove(c.id);
        if (Sync.isReady() && Sync.synced()[c.id] !== undefined) {
          const both = await Dialog.confirm('Eliminare anche la copia su GitHub? Altrimenti al prossimo Pull tornerebbe qui.', { okLabel: 'Sì, anche su GitHub', cancelLabel: 'No, solo qui', danger: true });
          if (both) { try { await Sync.removeRemote(c.id); } catch (e) { Dialog.toast('GitHub: ' + e.message, 5000); } }
        }
        render(); Dialog.toast('Campagna cancellata');
      }, 'ghost small danger');
      card.onclick = () => Game.open(c);
    }
  }

  // finestra "Nuova campagna": nome + dimensione della mappa (con quante sfide e video servono)
  function sizeHint(v) {
    const n = +v, cells = n * n, fights = cells - 1, videos = Math.ceil(fights / 3), keep = Game.keepCount();
    const pins = cells < keep ? `intoccabili: ${cells} scelti a caso tra i ${keep}` : `${keep} intoccabili + ${cells - keep} a caso`;
    return `${cells} giochi (${pins}) · ${fights} sfide · ${videos} video da 3 sfide, ~${(videos / 4.345).toFixed(1).replace('.', ',')} mesi a 1 a settimana`;
  }

  $('newBtn').onclick = async () => {
    const maxN = Math.floor(Math.sqrt(window.GAMES.length));
    const options = [];
    for (let n = 5; n <= maxN; n++) options.push({ value: String(n), label: `${n} × ${n}  (${n * n} giochi)` });
    const r = await Dialog.form('Nuova campagna', [
      { name: 'name', label: 'Nome della campagna', value: await nameFor('Campagna') },
      { name: 'size', label: 'Dimensione della mappa', type: 'select', value: '15', options, hintFn: sizeHint },
    ], 'Crea');
    if (!r || !r.name.trim()) return;
    await Titles.refresh();
    const c = Game.createCampaign(r.name.trim(), +r.size);
    const champs = Titles.forced(+r.size).length;
    if (champs) Dialog.toast(`👑 ${champs} ${champs === 1 ? 'campione' : 'campioni'} ${r.size}×${r.size} già in gara`, 4000);
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

  // ---- sync con GitHub: ⚙ token, ⬇ Pull, ⬆ Push (come nelle altre web app) ----
  let syncBusy = false;

  function updateSyncBar() {
    const st = $('syncStatus');
    if (Sync.isReady()) {
      const t = Sync.lastSync();
      st.textContent = '✓ Sync configurato' + (t ? ` · ultimo: ${fmtDate(t)}` : '');
      st.className = 'syncstatus ok';
    } else {
      st.textContent = '⚠ Sync non configurato: tocca ⚙';
      st.className = 'syncstatus';
    }
    for (const id of ['pullBtn', 'pushBtn']) $(id).disabled = syncBusy;
  }

  async function withSync(fn) {
    if (syncBusy || !(await Sync.ensureConfigured())) { updateSyncBar(); return; }
    syncBusy = true; updateSyncBar();
    try { await fn(); }
    catch (e) { Dialog.toast('GitHub: ' + e.message, 6000); }
    finally { syncBusy = false; await render(); }
  }

  const askConflict = (c, remoteDate) => Dialog.choose(
    `«${c.name}» è cambiata sia su questo dispositivo sia su GitHub (${fmtDate(remoteDate)}). Quale versione tieni? L'altra andrà persa.`, [
      { label: 'Salta', value: null },
      { label: 'Tieni GitHub', value: 'remote' },
      { label: 'Tieni questo dispositivo', value: 'local', kind: 'danger' },
    ], 'Conflitto');

  // ⬆ Push: manda su GitHub le campagne di questo dispositivo
  $('pushBtn').onclick = () => withSync(async () => {
    Dialog.toast('⬆ Push in corso…');
    const local = await Store.list(), remote = Object.fromEntries((await Sync.listRemote()).map(r => [r.campaign.id, r]));
    const synced = Sync.synced();
    const n = { up: 0, same: 0, behind: 0, down: 0, skip: 0 };
    for (const L of local) {
      const R = remote[L.id];
      if (!R) { await Sync.upload(L); Sync.markSynced(L.id, L.updated); n.up++; continue; }
      const ru = R.campaign.updated;
      if (ru === L.updated) { Sync.markSynced(L.id, L.updated); n.same++; continue; }
      const localDirty = synced[L.id] !== L.updated;
      const remoteChanged = synced[L.id] !== undefined && ru !== synced[L.id];
      if (ru > L.updated && !localDirty) { n.behind++; continue; }          // GitHub è più avanti: serve un Pull
      if (ru > L.updated || remoteChanged) {
        const r = await askConflict(L, ru);
        if (r === 'local') { await Sync.upload(L, R.sha); Sync.markSynced(L.id, L.updated); n.up++; }
        else if (r === 'remote') { await Store.put(R.campaign); Sync.markSynced(L.id, ru); n.down++; }
        else n.skip++;
        continue;
      }
      await Sync.upload(L, R.sha); Sync.markSynced(L.id, L.updated); n.up++;
    }
    const parts = [`${n.up} caricate`, n.same && `${n.same} già aggiornate`, n.down && `${n.down} scaricate`, n.behind && `${n.behind} più recenti su GitHub (fai Pull)`, n.skip && `${n.skip} saltate`].filter(Boolean);
    Dialog.toast('⬆ Push: ' + (parts.join(', ') || 'niente da fare'), 5000);
  });

  // ⬇ Pull: porta qui le campagne di GitHub
  $('pullBtn').onclick = () => withSync(async () => {
    Dialog.toast('⬇ Pull in corso…');
    const remote = await Sync.listRemote();
    const local = Object.fromEntries((await Store.list()).map(c => [c.id, c]));
    const synced = Sync.synced();
    const n = { add: 0, upd: 0, same: 0, ahead: 0, skip: 0 };
    for (const { campaign: R } of remote) {
      const L = local[R.id];
      if (!L) { await Store.put(R); Sync.markSynced(R.id, R.updated); n.add++; continue; }
      if (R.updated === L.updated) { Sync.markSynced(R.id, R.updated); n.same++; continue; }
      if (R.updated < L.updated) { n.ahead++; continue; }                    // il dispositivo è più avanti: serve un Push
      if (synced[R.id] !== L.updated) {                                       // modificata qui dopo l'ultima sync: conflitto
        const r = await askConflict(L, R.updated);
        if (r === 'remote') { await Store.put(R); Sync.markSynced(R.id, R.updated); n.upd++; }
        else if (r === 'local') n.ahead++; else n.skip++;
        continue;
      }
      await Store.put(R); Sync.markSynced(R.id, R.updated); n.upd++;
    }
    if (!remote.length) { Dialog.toast('⬇ Pull: su GitHub non ci sono ancora campagne.', 5000); return; }
    const parts = [n.add && `${n.add} nuove`, n.upd && `${n.upd} aggiornate`, n.same && `${n.same} già aggiornate`, n.ahead && `${n.ahead} più avanti qui (fai Push)`, n.skip && `${n.skip} saltate`].filter(Boolean);
    Dialog.toast('⬇ Pull: ' + (parts.join(', ') || 'niente da fare'), 5000);
  });

  // ⚙ token e repository
  $('syncCfgBtn').onclick = async () => {
    if (!(await Sync.configure())) { updateSyncBar(); return; }
    try { Dialog.toast('Connesso a ' + await Sync.test() + ' ✓'); }
    catch (e) { Dialog.toast('GitHub: ' + e.message, 6000); }
    updateSyncBar();
  };

  // numero di build in basso a sinistra: aumenta a ogni commit (vedi .githooks/pre-commit)
  (function () {
    const b = window.BUILD, tag = $('buildTag');
    if (!b) return;
    const d = new Date(b.date), when = isNaN(d) ? '' : ' · ' + d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    tag.textContent = `build ${b.n}${when}`;
  })();

  window.Menu = { render };
  Store.init().then(render);
})();
