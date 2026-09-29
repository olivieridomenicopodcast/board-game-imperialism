'use strict';
// Schermata di lotta stile Game Boy/Pokémon: barra HP che scende gradualmente (verde > 50%, arancione 20-50%,
// rossa < 20%), testo che avanza ed effetti delle mosse (battle-fx.js).
// API: BattleUI.play({ a, b, battle, speed, manual, stop, fx }) -> Promise;  BattleUI.skip()
//   a, b   = { fighter, color, cover }   (a = attaccante, in basso a sinistra; b = difensore, in alto a destra)
//   battle = risultato di Battle.fight (events, winner)
(function (root) {
  const COND_TAG = { paralisi: 'PAR', sonno: 'SON', confusione: 'CNF', debito: 'DEB', sabotaggio: 'SAB' };
  let ui = null, skipping = false, speed = 1, manual = true;
  let mode = 'idle', fast = false, advance = null;   // mode: typing | waiting | idle

  const sleep = ms => new Promise(r => (skipping ? r() : setTimeout(r, ms / speed)));

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function build() {
    const root_ = el('div', 'bs hidden', document.body);
    const gb = el('div', 'gb', root_);
    ui = { root: root_, gb, side: [] };
    // side 0 = attaccante (basso sx), side 1 = difensore (alto dx)
    for (const i of [1, 0]) {
      const sp = el('div', 'sprite s' + i, gb);
      const plat = el('div', 'plat', sp);
      const img = el('img', '', sp);
      img.alt = '';
      const condfx = el('span', 'condfx', sp);
      const box = el('div', 'box b' + i, gb);
      const top = el('div', 'bname', box);
      const nm = el('span', 'nm', top);
      const ty = el('span', 'ty', top);
      const row = el('div', 'brow', box);
      const tag = el('span', 'tag', row);
      const hpw = el('div', 'hpw', row);
      el('span', 'hplabel', hpw).textContent = 'HP';
      const track = el('div', 'track', hpw);
      const fill = el('div', 'fill', track);
      const num = el('div', 'hpnum', box);
      const prest = el('div', 'prest', box);
      ui.side[i] = { sp, plat, img, condfx, box, nm, ty, tag, fill, num, prest, max: 1, cur: 1 };
    }
    ui.fx = el('div', 'fx', gb);
    ui.fxApi = root.BattleFX.create({ gb, layer: ui.fx, sprites: [ui.side[0].img, ui.side[1].img], speed: () => speed, skipping: () => skipping });
    const tb = el('div', 'textbox', gb);
    ui.text = el('p', '', tb);
    ui.arrow = el('span', 'arrow', tb);
    const skip = el('button', 'skipbtn', gb);
    skip.type = 'button'; skip.textContent = 'Salta ▶▶';
    skip.onclick = () => api.skip();
    const stopBtn = el('button', 'skipbtn stopbtn', gb);
    stopBtn.type = 'button'; stopBtn.textContent = '⏸ Ferma auto';
    stopBtn.onclick = () => { if (ui.onStop) ui.onStop(); stopBtn.hidden = true; };
    ui.stopBtn = stopBtn;
    gb.addEventListener('click', e => { if (e.target !== skip) onInput(); });
    document.addEventListener('keydown', e => {
      if (ui.root.classList.contains('hidden')) return;
      if (e.key === 'Escape') api.skip();
      else if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); onInput(); }
    });
  }

  // clic / tasto: durante la scrittura completa il testo, a pagina finita passa alla successiva
  function onInput() {
    if (mode === 'typing') fast = true;
    else if (mode === 'waiting' && advance) { const r = advance; advance = null; r(); }
  }

  function waitAdvance() {
    if (skipping) return Promise.resolve();
    mode = 'waiting';
    ui.arrow.style.visibility = 'visible';
    return new Promise(r => { advance = r; }).then(() => { mode = 'idle'; ui.arrow.style.visibility = 'hidden'; });
  }

  function barColor(p) { return p > 0.5 ? 'var(--hp-green)' : p > 0.2 ? 'var(--hp-orange)' : 'var(--hp-red)'; }

  function setBar(i, cur) {
    const s = ui.side[i];
    s.cur = cur;
    const p = Math.max(0, Math.min(1, cur / s.max));
    s.fill.style.width = (p * 100) + '%';
    s.fill.style.background = barColor(p);
    s.num.textContent = `${Math.max(0, Math.round(cur))}/${s.max}`;
  }

  // la barra scende (o sale) gradualmente, come in Pokémon
  function animateBar(i, to) {
    const s = ui.side[i], from = s.cur;
    if (from === to) return Promise.resolve();
    if (skipping) { setBar(i, to); return Promise.resolve(); }
    const dur = Math.max(500, Math.min(1500, 400 + Math.abs(from - to) * 22)) / speed;
    return new Promise(res => {
      const t0 = performance.now();
      (function frame(now) {
        const t = skipping ? 1 : Math.min(1, (now - t0) / dur);
        setBar(i, from + (to - from) * t);
        if (t < 1) requestAnimationFrame(frame); else { setBar(i, to); res(); }
      })(t0);
    });
  }

  // scrive una riga in fondo alla pagina corrente (un clic durante la scrittura la completa subito)
  async function typeLine(text, first) {
    const prefix = first ? '' : ui.text.textContent + '\n';
    if (first) ui.arrow.style.visibility = 'hidden';
    fast = false; mode = 'typing';
    if (!skipping) {
      for (let k = 1; k <= text.length && !skipping && !fast; k++) {
        ui.text.textContent = prefix + text.slice(0, k);
        await sleep(22);
      }
    }
    ui.text.textContent = prefix + text;
    mode = 'idle';
  }

  // raggruppa gli eventi: una azione (usa -> esito -> note) = una pagina
  function pages(events) {
    const out = [];
    for (const ev of events) {
      const prev = out.length ? out[out.length - 1][out[out.length - 1].length - 1] : null;
      // la mossa di chi si è appena svegliato sta nella stessa pagina di "si sveglia!"
      const follow = ['miss', 'fail', 'status', 'hit', 'note', 'cure'].includes(ev.kind)
        || (ev.kind === 'use' && prev && prev.kind === 'wake' && prev.side === ev.side);
      if (follow && out.length) out[out.length - 1].push(ev); else out.push([ev]);
    }
    return out;
  }

  function setCond(i, kind) {
    const t = ui.side[i].tag;
    t.textContent = kind ? COND_TAG[kind] : '';
    t.className = 'tag' + (kind ? ' on c-' + kind : '');
    ui.side[i].condfx.textContent = kind ? root.BATTLE_COND_ICON[kind] : '';
  }

  function fill(i, f, color, cover) {
    const s = ui.side[i], t = (root.TYPES || []).find(x => x.id === f.type) || { icon: '', color: '#888' };
    s.nm.textContent = f.name;
    s.ty.textContent = `${t.icon} ${f.type}`;
    s.ty.style.background = t.color;
    s.max = f.maxHp;
    s.prest.textContent = f.prestige > 0.0005 ? `⭐ Prestigio +${Math.round(f.prestige * 100)}%` : '';
    s.img.src = cover;
    s.img.style.opacity = '1';
    s.img.getAnimations().forEach(x => x.cancel());
    s.plat.style.background = color;
    s.sp.style.setProperty('--c', color);
    setBar(i, f.maxHp);
    setCond(i, null);
  }

  const api = {
    async play({ a, b, battle, speed: sp = 1, manual: man = true, stop = null, fx = true }) {
      if (!ui) build();
      ui.onStop = stop; ui.stopBtn.hidden = !stop;
      skipping = false; speed = sp; manual = man; mode = 'idle';
      fill(0, a.fighter, a.color, a.cover);
      fill(1, b.fighter, b.color, b.cover);
      ui.text.textContent = '';
      ui.root.classList.remove('hidden');
      ui.fxApi.reset();
      const useFx = fx, fighters = [a.fighter, b.fighter];
      let lastMove = null;
      await Promise.all([sleep(400), useFx ? ui.fxApi.intro() : null]);
      for (const page of pages(battle.events)) {
        if (skipping) break;
        for (let k = 0; k < page.length && !skipping; k++) {
          const ev = page[k];
          if (ev.kind === 'use') lastMove = fighters[ev.side].moves.find(m => m.name === ev.move) || null;
          const fctx = { move: lastMove, fighters, next: page[k + 1] };
          const jobs = [typeLine(ev.text, k === 0)];
          if (ev.hp) for (const i of [0, 1]) jobs.push(animateBar(i, ev.hp[i]));
          if (ev.cond) [0, 1].forEach(i => setCond(i, ev.cond[i]));
          if (useFx && ev.kind !== 'use' && ev.kind !== 'intro') jobs.push(ui.fxApi.event(ev, fctx));
          await Promise.all(jobs);
          if (useFx && ev.kind === 'use') await ui.fxApi.event(ev, fctx);
          if (k < page.length - 1) await sleep(fast ? 120 : 450);
        }
        const kind = page[page.length - 1].kind;
        if (manual) await waitAdvance();
        else { ui.arrow.style.visibility = 'visible'; await sleep(kind === 'end' ? 1400 : 900); }
      }
      // stato finale (anche dopo "Salta")
      const last = battle.events[battle.events.length - 1];
      for (const i of [0, 1]) { setBar(i, last.hp[i]); setCond(i, last.cond[i]); }
      ui.side[1 - battle.winner].img.style.opacity = '0.25';
      if (skipping) { ui.text.textContent = last.text; await new Promise(r => setTimeout(r, 350)); }
      ui.root.classList.add('hidden');
    },
    skip() { skipping = true; onInput(); if (ui) ui.fxApi.stop(); },
    get active() { return !!ui && !ui.root.classList.contains('hidden'); },
  };
  root.BattleUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
