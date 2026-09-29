'use strict';
// Sync dei salvataggi con un repository GitHub tramite token personale (API "contents").
// Ogni campagna è un file JSON: <cartella>/<id>.json. Il token resta solo nel localStorage di questo browser.
// Consigliato: token "fine-grained" limitato a UN repo con permesso Contents: Read and write.
(function (root) {
  const KEY = 'bgi.sync';
  const API = 'https://api.github.com';

  function config() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveConfig(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* non disponibile */ } }
  const ready = c => !!(c.repo && /^[^/\s]+\/[^/\s]+$/.test(c.repo) && c.token);

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  }

  async function gh(cfg, method, path, body) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + cfg.token,
                   ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw new Error('Impossibile contattare GitHub (sei online?)'); }
    if (res.status === 404) {
      if (method === 'GET') return { status: 404 };
      throw new Error('GitHub: non trovato (404). Controlla nome del repository, branch e permessi del token.');
    }
    if (res.status === 422) throw new Error('GitHub ha rifiutato la richiesta (422): il branch esiste?');
    if (res.status === 401) throw new Error('Token non valido o scaduto.');
    if (res.status === 403) throw new Error('Accesso negato: controlla i permessi del token (Contents: Read and write).');
    if (!res.ok) throw new Error('Errore GitHub ' + res.status);
    return { status: res.status, data: await res.json() };
  }

  const dir = c => (c.dir || 'saves').replace(/^\/+|\/+$/g, '');
  const branchQ = c => (c.branch ? '?ref=' + encodeURIComponent(c.branch) : '');

  const api = {
    config, ready,
    isReady() { return ready(config()); },

    // finestra di impostazioni; ritorna true se salvate
    async configure() {
      const c = config();
      const r = await Dialog.form('Sync con GitHub', [
        { name: 'repo', label: 'Repository (utente/nome)', value: c.repo || '', placeholder: 'olivieridomenicopodcast/board-game-imperialism' },
        { name: 'branch', label: 'Branch (vuoto = quello predefinito del repository)', value: c.branch || '' },
        { name: 'dir', label: 'Cartella dei salvataggi', value: c.dir || 'saves' },
        { name: 'token', label: 'Token personale GitHub', value: c.token || '', type: 'password',
          hint: 'Resta solo in questo browser. Crea un token fine-grained su un solo repo con permesso Contents: Read and write.' },
      ]);
      if (!r) return false;
      saveConfig({ repo: r.repo.trim(), branch: r.branch.trim(), dir: r.dir.trim() || 'saves', token: r.token.trim() });
      return ready(config());
    },

    async ensureConfigured() {
      if (ready(config())) return true;
      return this.configure();
    },

    // Controlla token e repository. Ritorna il nome del repo o lancia un errore chiaro.
    async test() {
      const cfg = config();
      const r = await gh(cfg, 'GET', `/repos/${cfg.repo}`);
      if (r.status === 404) throw new Error('Repository non trovato (nome sbagliato o token senza accesso).');
      if (cfg.branch) {
        const b = await gh(cfg, 'GET', `/repos/${cfg.repo}/branches/${encodeURIComponent(cfg.branch)}`);
        if (b.status === 404) throw new Error(`Il branch "${cfg.branch}" non esiste in questo repository (il branch predefinito è "${r.data.default_branch}"). Lascia il campo Branch vuoto per usare quello predefinito.`);
      }
      return r.data.full_name;
    },

    // Elenco delle campagne online: [{campaign, sha}] (i file non validi sono ignorati)
    async listRemote() {
      const cfg = config();
      const res = await gh(cfg, 'GET', `/repos/${cfg.repo}/contents/${dir(cfg)}${branchQ(cfg)}`);
      if (res.status === 404) {                       // cartella assente oppure branch/repository sbagliato?
        await this.test();
        return [];
      }
      const out = [];
      for (const f of res.data.filter(f => f.type === 'file' && f.name.endsWith('.json'))) {
        const one = await gh(cfg, 'GET', `/repos/${cfg.repo}/contents/${f.path.split('/').map(encodeURIComponent).join('/')}${branchQ(cfg)}`);
        if (one.status === 404) continue;
        try {
          const c = JSON.parse(b64decode(one.data.content));
          if (!Store.validate(c)) out.push({ campaign: c, sha: one.data.sha });
        } catch (e) { /* file non valido: ignorato */ }
      }
      return out;
    },

    // Scrive (o aggiorna, se si passa lo sha) il file di una campagna.
    async upload(campaign, sha) {
      const cfg = config();
      const path = `${dir(cfg)}/${campaign.id}.json`;
      await gh(cfg, 'PUT', `/repos/${cfg.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
        message: `Salva campagna: ${campaign.name}`,
        content: b64encode(JSON.stringify(campaign)),
        ...(cfg.branch ? { branch: cfg.branch } : {}),
        ...(sha ? { sha } : {}),
      });
    },

    // Cancella dal repository la copia di una campagna (se esiste).
    async removeRemote(id) {
      const cfg = config();
      const path = `${dir(cfg)}/${id}.json`;
      const url = `/repos/${cfg.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const cur = await gh(cfg, 'GET', url + branchQ(cfg));
      if (cur.status === 404) return false;
      await gh(cfg, 'DELETE', url, { message: `Elimina campagna ${id}`, sha: cur.data.sha, ...(cfg.branch ? { branch: cfg.branch } : {}) });
      return true;
    },

    // Per ogni campagna: il valore di "updated" all'ultima sincronizzazione riuscita (serve a riconoscere i conflitti).
    synced() { try { return JSON.parse(localStorage.getItem('bgi.synced')) || {}; } catch (e) { return {}; } },
    markSynced(id, updated) {
      const m = this.synced(); m[id] = updated;
      try { localStorage.setItem('bgi.synced', JSON.stringify(m)); localStorage.setItem('bgi.lastSync', String(Date.now())); } catch (e) { /* ok */ }
    },
    lastSync() { const v = +localStorage.getItem('bgi.lastSync'); return v || null; },
  };
  root.Sync = api;
})(window);
