'use strict';
// Correzioni ai tipi fatte a mano dalla scheda del gioco. Restano nel browser (localStorage) e
// sovrascrivono i tipi di data/stats.js. Con esporta() si ottiene un file da portare nel repo.
(function (root) {
  const KEY = 'bgi.typeOverrides';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* non disponibile */ } };

  // tipo originale di ogni gioco, prima di applicare le correzioni
  const original = {};
  for (const [id, s] of Object.entries(root.STATS)) original[id] = s.t;
  const apply = () => {
    const o = read();
    for (const id of Object.keys(root.STATS)) root.STATS[id].t = o[id] || original[id];
  };
  apply();

  const notify = () => window.dispatchEvent(new CustomEvent('typechange'));

  root.TypeOverrides = {
    original: id => original[id],
    isChanged: id => !!read()[id],
    count: () => Object.keys(read()).length,
    set(id, type) {
      const o = read();
      if (type === original[id]) delete o[id]; else o[id] = type;
      write(o); apply(); notify();
    },
    clear(id) { const o = read(); delete o[id]; write(o); apply(); notify(); },
    // formato di data/type_overrides.json ("set": {"numero gioco": "Tipo"})
    export() {
      const o = read(), byId = Object.fromEntries(root.GAMES.map(g => [g.id, g.n]));
      return { set: Object.fromEntries(Object.entries(o).map(([id, t]) => [String(byId[id]), t])) };
    },
  };
})(window);
