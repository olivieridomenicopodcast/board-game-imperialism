'use strict';
// Salvataggi: ogni campagna è un record in IndexedDB (con ripiego su localStorage se non disponibile).
// Una campagna salva gli id dei giochi (non le immagini): cambiare le copertine non rompe i salvataggi.
//
// Campagna: { v, id, name, created, updated, games:[id], colors:[hex], owner:[idx], wins:[n], turn, log:[ev], winner }
(function (root) {
  const DB = 'board-game-imperialism', STORE = 'campaigns', LS_KEY = 'bgi.campaigns', LS_LAST = 'bgi.last';
  const VERSION = 1;
  let db = null, useLS = false;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function lsRead() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; } }
  function lsWrite(o) { localStorage.setItem(LS_KEY, JSON.stringify(o)); }

  function init() {
    if (db || useLS) return Promise.resolve();
    return new Promise(resolve => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => { db = req.result; resolve(); };
        req.onerror = req.onblocked = () => { useLS = true; resolve(); };
      } catch (e) { useLS = true; resolve(); }
    });
  }

  function tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }

  const api = {
    VERSION, uid, init,
    async list() {
      await init();
      const all = useLS ? Object.values(lsRead()) : await tx('readonly', s => s.getAll());
      return (all || []).sort((a, b) => b.updated - a.updated);
    },
    async get(id) {
      await init();
      return useLS ? lsRead()[id] : tx('readonly', s => s.get(id));
    },
    async put(c) {
      await init();
      if (useLS) { const o = lsRead(); o[c.id] = c; lsWrite(o); return; }
      await tx('readwrite', s => s.put(c));
    },
    async remove(id) {
      await init();
      if (useLS) { const o = lsRead(); delete o[id]; lsWrite(o); return; }
      await tx('readwrite', s => s.delete(id));
    },
    get storageKind() { return useLS ? 'localStorage' : 'IndexedDB'; },
    lastId() { try { return localStorage.getItem(LS_LAST); } catch (e) { return null; } },
    setLast(id) { try { localStorage.setItem(LS_LAST, id); } catch (e) { /* non disponibile */ } },

    // Nuova campagna vuota dai giochi e dai colori scelti (ogni gioco parte nella propria casella).
    create(name, gameIds, colors) {
      const now = Date.now();
      return { v: VERSION, id: uid(), name, created: now, updated: now, games: gameIds, colors,
               owner: gameIds.map((_, i) => i), wins: gameIds.map(() => 0), turn: 0, log: [], winner: null };
    },

    // Controlla che un oggetto (da file o da GitHub) sia una campagna valida.
    validate(c) {
      const n = c && c.games && c.games.length;
      if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !n) return 'Il file non è una campagna valida.';
      if (!['colors', 'owner', 'wins'].every(k => Array.isArray(c[k]) && c[k].length === n)) return 'Dati della campagna incompleti.';
      if (c.owner.some(o => !Number.isInteger(o) || o < 0 || o >= n)) return 'Dati della mappa non validi.';
      if (c.v > VERSION) return 'Salvataggio creato da una versione più nuova del gioco.';
      return null;
    },

    progress(c) { return { alive: new Set(c.owner).size, total: c.games.length }; },
  };
  root.Store = api;
})(window);
