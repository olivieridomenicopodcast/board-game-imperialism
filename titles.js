'use strict';
// Titoli: chi vince una campagna (ultimo gioco rimasto) ottiene un titolo per QUELLA dimensione di griglia.
// Il campione in carica di una dimensione è l'ultimo vincitore; perde il simbolo quando un altro vince la stessa dimensione.
// I titoli si ricavano da tutte le campagne salvate (campo stats.winner, stats.js), quindi viaggiano con il sync.
// Alla prossima campagna della stessa dimensione i vincitori sono obbligati a partecipare (Titles.forced).
(function (root) {
  let cache = {};                 // lato -> { counts: {idGioco: n}, champion: idGioco, at: quando }

  const sizeOf = c => c.size || Math.round(Math.sqrt(c.games.length));

  function compute(campaigns) {
    const out = {};
    for (const c of campaigns) {
      const w = c.stats && c.stats.winner;
      if (!w) continue;
      const s = out[sizeOf(c)] || (out[sizeOf(c)] = { counts: {}, champion: null, at: -1 });
      s.counts[w] = (s.counts[w] || 0) + 1;
      const at = c.stats.doneAt || c.updated || 0;
      if (at >= s.at) { s.at = at; s.champion = w; }
    }
    return out;
  }

  const api = {
    compute,
    async refresh() { try { cache = compute(await Store.list()); } catch (e) { /* senza titoli il gioco funziona lo stesso */ } return cache; },
    count: (size, id) => (cache[size] && cache[size].counts[id]) || 0,
    isChamp: (size, id) => !!cache[size] && cache[size].champion === id,
    champion: size => (cache[size] && cache[size].champion) || null,
    // id dei vincitori di questa dimensione: prima il campione in carica, poi chi ha più titoli
    forced(size) {
      const s = cache[size];
      if (!s) return [];
      return Object.keys(s.counts).sort((a, b) => (b === s.champion) - (a === s.champion) || s.counts[b] - s.counts[a]);
    },
    label: (size, id) => { const n = api.count(size, id); return n ? `👑${n}` : ''; },
  };
  root.Titles = api;
})(window);
