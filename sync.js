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
    if (res.status === 404) return { status: 404 };
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
        { name: 'branch', label: 'Branch', value: c.branch || 'main' },
        { name: 'dir', label: 'Cartella dei salvataggi', value: c.dir || 'saves' },
        { name: 'token', label: 'Token personale GitHub', value: c.token || '', type: 'password',
          hint: 'Resta solo in questo browser. Crea un token fine-grained su un solo repo con permesso Contents: Read and write.' },
      ]);
      if (!r) return false;
      saveConfig({ repo: r.repo.trim(), branch: r.branch.trim() || 'main', dir: r.dir.trim() || 'saves', token: r.token.trim() });
      return ready(config());
    },

    async ensureConfigured() {
      if (ready(config())) return true;
      return this.configure();
    },

    // Carica (o aggiorna) una campagna. Se online c'è una versione più recente chiede conferma.
    async push(campaign) {
      const cfg = config();
      const path = `${dir(cfg)}/${campaign.id}.json`;
      const url = `/repos/${cfg.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const cur = await gh(cfg, 'GET', url + branchQ(cfg));
      let sha;
      if (cur.status !== 404) {
        sha = cur.data.sha;
        let remote = null;
        try { remote = JSON.parse(b64decode(cur.data.content)); } catch (e) { /* file illeggibile: si sovrascrive */ }
        if (remote && remote.updated > campaign.updated) {
          const ok = await Dialog.confirm(`Su GitHub c'è una versione più recente di «${campaign.name}». Sovrascriverla con quella di questo dispositivo?`,
            { okLabel: 'Sovrascrivi', danger: true });
          if (!ok) return false;
        }
      }
      await gh(cfg, 'PUT', url, {
        message: `Salva campagna: ${campaign.name}`,
        content: b64encode(JSON.stringify(campaign)),
        ...(cfg.branch ? { branch: cfg.branch } : {}),
        ...(sha ? { sha } : {}),
      });
      return true;
    },

    // Elenco delle campagne online: [{id, name, updated, progress, campaign}]
    async list() {
      const cfg = config();
      const res = await gh(cfg, 'GET', `/repos/${cfg.repo}/contents/${dir(cfg)}${branchQ(cfg)}`);
      if (res.status === 404) return [];
      const out = [];
      for (const f of res.data.filter(f => f.type === 'file' && f.name.endsWith('.json'))) {
        const one = await gh(cfg, 'GET', `/repos/${cfg.repo}/contents/${f.path.split('/').map(encodeURIComponent).join('/')}${branchQ(cfg)}`);
        if (one.status === 404) continue;
        try {
          const c = JSON.parse(b64decode(one.data.content));
          if (!Store.validate(c)) out.push(c);
        } catch (e) { /* file non valido: ignorato */ }
      }
      return out.sort((a, b) => b.updated - a.updated);
    },
  };
  root.Sync = api;
})(window);
