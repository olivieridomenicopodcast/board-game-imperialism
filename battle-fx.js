'use strict';
// Effetti visivi della schermata di lotta: sprite che scattano, proiettili emoji per tipo di mossa,
// effetti delle condizioni, numeri dei danni, critici, K.O. Tutto con la Web Animations API, senza librerie.
// BattleFX.create({ gb, layer, sprites:[img0,img1], speed: () => n, skipping: () => bool }) -> oggetto con i metodi:
//   intro(), event(ev, ctx)   (ctx = { move, fighters, next })   e   reset(), stop()
(function (root) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const T = (x, y, extra = '') => `translate(${x}px,${y}px) translate(-50%,-50%) ${extra}`;

  // Sprite ("emoji") dei proiettili per tipo: proj = proiettili, burst = esplosione all'impatto
  const TYPE_FX = {
    Strategia:     { proj: ['♟️', '🚩'], burst: '🚩', arc: 30 },
    Astratto:      { proj: ['🔷', '🔶'], burst: '✨', spin: 360 },
    Gestionale:    { proj: ['⚙️'], burst: '🔩', spin: 720 },
    Economia:      { proj: ['💰', '🪙'], burst: '💸', arc: 90, spin: 360 },
    Guerra:        { proj: ['⚔️', '🏹'], burst: '💥', spin: 180 },
    Deduzione:     { proj: ['🔍', '❓'], burst: '❗', arc: 20 },
    Cooperativo:   { proj: ['🤝', '💪'], burst: '✨', arc: 40 },
    Ambientazione: { proj: ['🔮', '🔥'], burst: '🌟', arc: 40, spin: 90 },
    Carte:         { proj: ['🃏', '🎴'], burst: '✨', arc: 50, spin: 540 },
    Fortuna:       { proj: ['🎲'], burst: '🍀', arc: 120, spin: 720 },
    Party:         { proj: ['🎉', '🎊', '🎈'], burst: '🎊', arc: 60 },
    Bambini:       { proj: ['🧸', '🎈', '⭐'], burst: '⭐', arc: 70, spin: 30 },
  };
  // mosse neutre: per nome
  const NEUTRAL_FX = {
    'Tira i Dadi': { proj: ['🎲'], arc: 100, spin: 720 },
    'Pesca una Carta': { proj: ['🃏'], arc: 40, spin: 360 },
    'Regola della Casa': { proj: ['📜', '🏠'], arc: 30 },
    'Cambio di Piano': { proj: ['🔄'], spin: 720 },
    'Partita a Oltranza': { proj: ['⏳', '🕰️'], spin: 360 },
  };
  const STATUS_FX = { paralisi: '⚡', sonno: '💤', confusione: '💫', debito: '💸', sabotaggio: '🔧' };
  root.BATTLE_COND_ICON = { paralisi: '⚡', sonno: '💤', confusione: '💫', debito: '💸', sabotaggio: '☁️' };

  function create(cfg) {
    const { gb, layer, sprites } = cfg;
    const speed = () => (cfg.speed() || 1);
    const skipping = () => cfg.skipping();
    const unit = () => gb.clientWidth;

    function part(text, size = 1, cls = '') {
      const e = document.createElement('span');
      e.className = 'fxp ' + cls;
      e.textContent = text;
      e.style.fontSize = (unit() * 0.085 * size) + 'px';
      layer.appendChild(e);
      return e;
    }

    // esegue un'animazione su un elemento che poi viene rimosso
    function run(e, frames, dur, opts = {}) {
      if (skipping()) { e.remove(); return Promise.resolve(); }
      const a = e.animate(frames, { duration: dur / speed(), fill: 'both', easing: 'ease-out', ...opts,
                                    delay: (opts.delay || 0) / speed() });
      return a.finished.then(() => e.remove(), () => e.remove());
    }

    // animazione di uno sprite (l'immagine del gioco): non viene rimosso
    function spr(i, frames, dur, opts = {}) {
      if (skipping()) return Promise.resolve();
      const a = sprites[i].animate(frames, { duration: dur / speed(), easing: 'ease-out', ...opts });
      return a.finished.then(() => {}, () => {});
    }

    const pos = i => {
      const g = gb.getBoundingClientRect(), r = sprites[i].getBoundingClientRect();
      return { x: r.left - g.left + r.width / 2, y: r.top - g.top + r.height / 2, w: r.width, h: r.height };
    };
    const sleep = ms => (skipping() ? Promise.resolve() : new Promise(r => setTimeout(r, ms / speed())));

    // ---- mattoncini ----
    // proiettile che vola da un punto all'altro (con arco e rotazione)
    function fly(emoji, from, to, o = {}) {
      const jobs = [];
      for (let k = 0; k < (o.count || 1); k++) {
        const e = part(emoji, o.size || 1);
        const jx = rnd(-1, 1) * (o.spread || 0), jy = rnd(-1, 1) * (o.spread || 0), sp = o.spin || 0;
        const mid = { x: (from.x + to.x) / 2 + jx, y: (from.y + to.y) / 2 - (o.arc || 0) + jy };
        jobs.push(run(e, [
          { transform: T(from.x, from.y, 'scale(.3) rotate(0deg)'), opacity: 0 },
          { transform: T(from.x, from.y, 'scale(1) rotate(0deg)'), opacity: 1, offset: 0.12 },
          { transform: T(mid.x, mid.y, `scale(1.15) rotate(${sp / 2}deg)`), opacity: 1, offset: 0.55 },
          { transform: T(to.x + jx, to.y + jy, `scale(1) rotate(${sp}deg)`), opacity: 1, offset: 0.95 },
          { transform: T(to.x + jx, to.y + jy, `scale(1.5) rotate(${sp}deg)`), opacity: 0 },
        ], o.dur || 650, { delay: k * (o.stagger || 110), easing: 'linear' }));
      }
      return Promise.all(jobs);
    }

    // esplosione di emoji che si allargano e svaniscono
    function burst(emoji, at, o = {}) {
      const jobs = [], n = o.count || 6, R = (o.radius || 0.14) * unit();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd(-0.3, 0.3), r = R * rnd(0.7, 1.3), e = part(pick([].concat(emoji)), o.size || 0.9);
        jobs.push(run(e, [
          { transform: T(at.x, at.y, 'scale(.4)'), opacity: 1 },
          { transform: T(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, `scale(1.3) rotate(${rnd(-90, 90)}deg)`), opacity: 1, offset: 0.6 },
          { transform: T(at.x + Math.cos(a) * r * 1.3, at.y + Math.sin(a) * r * 1.3 + 12, 'scale(.7)'), opacity: 0 },
        ], o.dur || 700, { delay: k * 15 }));
      }
      return Promise.all(jobs);
    }

    // emoji che salgono ondeggiando (sonno, guarigione…)
    function rise(emoji, at, o = {}) {
      const jobs = [], n = o.count || 3;
      for (let k = 0; k < n; k++) {
        const e = part(emoji, o.size || 0.9), x = at.x + rnd(-0.06, 0.06) * unit() + (k - n / 2) * 0.03 * unit();
        jobs.push(run(e, [
          { transform: T(x, at.y - 0.02 * unit(), 'scale(.4)'), opacity: 0 },
          { transform: T(x + 12, at.y - 0.08 * unit(), 'scale(1)'), opacity: 1, offset: 0.25 },
          { transform: T(x - 12, at.y - 0.17 * unit(), 'scale(1.2)'), opacity: 1, offset: 0.65 },
          { transform: T(x + 6, at.y - 0.26 * unit(), 'scale(1.3)'), opacity: 0 },
        ], o.dur || 1100, { delay: k * 220, easing: 'linear' }));
      }
      return Promise.all(jobs);
    }

    // stelline/emoji che girano intorno alla testa
    function orbit(emoji, at, o = {}) {
      const jobs = [], n = o.count || 3, R = 0.07 * unit(), cy = at.y - at.h * 0.42;
      for (let k = 0; k < n; k++) {
        const e = part(emoji, o.size || 0.8), frames = [];
        for (let s = 0; s <= 16; s++) {
          const a = (s / 16) * Math.PI * 2 * 1.5 + (k / n) * Math.PI * 2;
          frames.push({ transform: T(at.x + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 0.5, 'scale(1)'), opacity: s === 0 || s === 16 ? 0 : 1 });
        }
        jobs.push(run(e, frames, o.dur || 1300, { easing: 'linear' }));
      }
      return Promise.all(jobs);
    }

    // scritta/numero che sale e svanisce (danni, "SUPEREFFICACE!", ...)
    function popup(text, at, o = {}) {
      const e = part(text, o.size || 0.5, 'fxpop');
      if (o.color) e.style.color = o.color;
      const y0 = at.y - (o.lift || 0);
      return run(e, [
        { transform: T(at.x, y0 + 8, 'scale(.4)'), opacity: 0 },
        { transform: T(at.x, y0 - 6, 'scale(1.25)'), opacity: 1, offset: 0.2 },
        { transform: T(at.x, y0 - 14, 'scale(1)'), opacity: 1, offset: 0.65 },
        { transform: T(at.x, y0 - (o.rise || 0.09) * unit(), 'scale(1)'), opacity: 0 },
      ], o.dur || 1100, { easing: 'ease-out' });
    }

    function screenFlash(color = '#fff', op = 0.6) {
      if (skipping()) return Promise.resolve();
      const e = document.createElement('div');
      e.className = 'fxflash'; e.style.background = color;
      layer.appendChild(e);
      return run(e, [{ opacity: 0 }, { opacity: op, offset: 0.25 }, { opacity: 0 }], 260, { easing: 'linear' });
    }

    function screenShake(amp = 1.4) {
      if (skipping()) return Promise.resolve();
      const a = (n) => `${rnd(-amp, amp) * n}cqw`;
      const fr = [{ transform: 'none' }];
      for (let k = 0; k < 8; k++) fr.push({ transform: `translate(${a(1 - k / 8)}, ${a(1 - k / 8)})` });
      fr.push({ transform: 'none' });
      return gb.animate(fr, { duration: 420 / speed(), easing: 'linear' }).finished.then(() => {}, () => {});
    }

    const shakeSprite = (i, amp = 0.025, n = 6) => {
      const fr = [{ transform: 'none' }];
      for (let k = 0; k < n; k++) fr.push({ transform: `translateX(${(k % 2 ? -1 : 1) * amp * unit() * (1 - k / (n + 1))}px)` });
      fr.push({ transform: 'none' });
      return spr(i, fr, 420, { easing: 'linear' });
    };
    const flashSprite = (i, color = 'white') => spr(i, [
      { filter: 'none' }, { filter: color === 'white' ? 'brightness(3) saturate(0)' : `drop-shadow(0 0 1.2cqw ${color}) brightness(1.8)` },
      { filter: 'none' }, { filter: color === 'white' ? 'brightness(3) saturate(0)' : `drop-shadow(0 0 1.2cqw ${color}) brightness(1.8)` }, { filter: 'none' },
    ], 480, { easing: 'linear' });

    // lo sprite che attacca scatta verso l'avversario e torna indietro
    const lunge = (i, to) => {
      const from = pos(i), dx = (to.x - from.x) * 0.32, dy = (to.y - from.y) * 0.32;
      return spr(i, [
        { transform: 'none' },
        { transform: `translate(${-dx * 0.15}px, ${-dy * 0.15}px) scale(.96)`, offset: 0.2 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.08)`, offset: 0.5 },
        { transform: 'none' },
      ], 480, { easing: 'ease-in-out' });
    };
    const dodge = i => spr(i, [
      { transform: 'none' }, { transform: `translateX(${(i === 1 ? 1 : -1) * unit() * 0.09}px) rotate(${i === 1 ? 8 : -8}deg)`, offset: 0.35 },
      { transform: `translateX(${(i === 1 ? 1 : -1) * unit() * 0.09}px) rotate(${i === 1 ? 8 : -8}deg)`, offset: 0.65 }, { transform: 'none' },
    ], 650, { easing: 'ease-in-out' });

    // ---- effetti per evento ----
    async function attack(ev, ctx) {
      const i = ev.side, j = 1 - i, m = ctx.move, from = pos(i), to = pos(j);
      if (!m) return;
      const missed = ctx.next && ctx.next.kind === 'miss';
      const target = missed ? { x: to.x + (j === 1 ? 1 : -1) * unit() * 0.3, y: to.y - unit() * 0.04 } : to;
      if (m.kind === 'status') {
        // lo sprite si gonfia e lancia l'emoji della condizione
        const icon = STATUS_FX[m.status];
        await Promise.all([
          spr(i, [{ transform: 'none' }, { transform: 'scale(1.1)' }, { transform: 'none' }], 450),
          fly(icon, from, target, { count: 3, stagger: 100, dur: 650, arc: 30, spread: unit() * 0.02, size: 0.9 }),
          missed ? dodge(j) : Promise.resolve(),
        ]);
        return;
      }
      const tier = m.kind === 'type' ? (m.power >= 85 ? 3 : m.power >= 70 ? 2 : 1) : 1;
      const set = m.kind === 'type' ? TYPE_FX[ctx.fighters[i].type] : (NEUTRAL_FX[m.name] || { proj: ['💥'] });
      const jobs = [lunge(i, to)];
      for (const [k, emoji] of set.proj.entries()) {
        jobs.push(fly(emoji, from, target, { count: k === 0 ? tier : Math.max(1, tier - 1), stagger: 90, dur: 620, arc: set.arc || 0,
          spin: set.spin || 0, size: 0.9 + tier * 0.22, spread: unit() * 0.018 * tier }));
      }
      if (missed) jobs.push(dodge(j));
      await Promise.all(jobs);
    }

    async function hit(ev, ctx) {
      const j = 1 - ev.side, at = pos(j), m = ctx.move;
      const set = m && m.kind === 'type' ? TYPE_FX[ctx.fighters[ev.side].type] : null;
      const tier = m && m.kind === 'type' ? (m.power >= 85 ? 3 : m.power >= 70 ? 2 : 1) : 1;
      const jobs = [
        shakeSprite(j, ev.crit ? 0.05 : 0.03, ev.crit ? 8 : 6),
        flashSprite(j),
        burst(set ? set.burst : '💥', at, { count: 4 + tier * 2 + (ev.crit ? 4 : 0), size: 0.8 + tier * 0.15 + (ev.crit ? 0.3 : 0) }),
        popup(`-${ev.dmg}`, at, { size: ev.crit ? 0.95 : 0.7, color: ev.crit ? '#ffd23a' : '#fff', lift: at.h * 0.35, rise: 0.12 }),
      ];
      if (ev.crit) {
        jobs.push(burst('⭐', at, { count: 8, radius: 0.2, size: 1.1 }), screenShake(1.6), screenFlash('#ffe58a', 0.55),
                  popup('CRITICO!', { x: at.x, y: at.y + at.h * 0.15 }, { size: 0.6, color: '#ffd23a', rise: 0.1 }));
      }
      if (ev.eff === 'super') {
        jobs.push(screenFlash('#fff', 0.5), burst('✨', at, { count: 6, radius: 0.18 }),
                  popup('SUPEREFFICACE!', { x: gb.clientWidth / 2, y: gb.clientWidth * 0.43 }, { size: 0.6, color: '#38c030', rise: 0.05, dur: 1300 }));
      } else if (ev.eff === 'weak') {
        jobs.push(popup('poco efficace…', { x: gb.clientWidth / 2, y: gb.clientWidth * 0.43 }, { size: 0.45, color: '#7a7a7a', rise: 0.05, dur: 1300 }));
      }
      await Promise.all(jobs);
    }

    async function miss(ev) {
      const j = 1 - ev.side, at = pos(j);
      await Promise.all([burst('💨', { x: at.x + (j === 1 ? 1 : -1) * unit() * 0.12, y: at.y }, { count: 3, radius: 0.07, size: 0.9 }),
                         popup('MANCATO!', at, { size: 0.55, color: '#ff8a4d', lift: at.h * 0.35 })]);
    }

    async function status(ev) {
      const j = 1 - ev.side, at = pos(j), kind = ev.status;
      const jobs = [];
      if (kind === 'paralisi') {
        for (let k = 0; k < 6; k++) {
          const e = part('⚡', 1.2), p = { x: at.x + rnd(-0.5, 0.5) * at.w, y: at.y + rnd(-0.5, 0.5) * at.h };
          jobs.push(run(e, [{ transform: T(p.x, p.y, 'scale(.3)'), opacity: 0 }, { transform: T(p.x, p.y, 'scale(1.3)'), opacity: 1, offset: 0.2 },
                            { transform: T(p.x, p.y, 'scale(.9)'), opacity: 0.2, offset: 0.4 }, { transform: T(p.x, p.y, 'scale(1.2)'), opacity: 1, offset: 0.6 },
                            { transform: T(p.x, p.y, 'scale(1)'), opacity: 0 }], 800, { delay: k * 90 }));
        }
        jobs.push(flashSprite(j, '#ffd23a'), shakeSprite(j, 0.012, 10));
      } else if (kind === 'sonno') {
        jobs.push(rise('💤', at, { count: 4, size: 1.1 }), spr(j, [{ filter: 'none' }, { filter: 'brightness(.65) saturate(.6)' }, { filter: 'none' }], 900));
      } else if (kind === 'confusione') {
        jobs.push(orbit('💫', at, { count: 4, size: 0.9 }), spr(j, [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], 800));
      } else if (kind === 'debito') {
        jobs.push(burst(['💸', '🧾'], at, { count: 7, radius: 0.16, size: 1 }), flashSprite(j, '#9b59d0'));
      } else if (kind === 'sabotaggio') {
        for (let k = 0; k < 4; k++) jobs.push(fly('☁️', { x: at.x + rnd(-0.6, 0.6) * at.w, y: at.y - at.h * 0.7 }, { x: at.x + rnd(-0.3, 0.3) * at.w, y: at.y - at.h * 0.05 },
          { dur: 800, size: 1.4, stagger: 80 }));
        jobs.push(burst('🔧', at, { count: 4, radius: 0.1, size: 0.9 }), flashSprite(j, '#b04030'));
      }
      jobs.push(popup(({ paralisi: 'PARALISI!', sonno: 'SONNO!', confusione: 'CONFUSIONE!', debito: 'DEBITO!', sabotaggio: 'SABOTAGGIO!' })[kind] || '', at,
        { size: 0.5, color: '#fff', lift: at.h * 0.45, rise: 0.07, dur: 1300 }));
      await Promise.all(jobs);
    }

    async function skip(ev) {
      const i = ev.side, at = pos(i), kind = ev.cond && ev.cond[i];
      if (kind === 'sonno') await rise('💤', at, { count: 3, size: 1.1 });
      else await Promise.all([burst('⚡', at, { count: 5, radius: 0.08, size: 1 }), flashSprite(i, '#ffd23a'), shakeSprite(i, 0.015, 8)]);
    }
    async function selfHit(ev) {
      const at = pos(ev.side);
      await Promise.all([orbit('💫', at, { count: 3 }), shakeSprite(ev.side), flashSprite(ev.side), popup(`-${ev.dmg}`, at, { size: 0.7, lift: at.h * 0.35, rise: 0.12 })]);
    }
    async function dot(ev) {
      const at = pos(ev.side);
      await Promise.all([burst('💸', at, { count: 5, radius: 0.12 }), flashSprite(ev.side, '#9b59d0'), popup(`-${ev.dmg}`, at, { size: 0.6, color: '#d9a6ff', lift: at.h * 0.35, rise: 0.1 })]);
    }
    async function cure(ev) {
      const at = pos(ev.side);
      await Promise.all([burst('✨', at, { count: 7, radius: 0.13 }), spr(ev.side, [{ filter: 'brightness(1.6)' }, { filter: 'none' }], 500),
                         popup(ev.kind === 'wake' ? 'sveglio!' : 'guarito!', at, { size: 0.45, color: '#38c030', lift: at.h * 0.4 })]);
    }

    // entrata in scena: gli sprite arrivano dai lati e compare "VS"
    async function intro() {
      if (skipping()) return;
      await Promise.all([
        spr(0, [{ transform: `translateX(${-unit() * 0.6}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 650, { easing: 'cubic-bezier(.2,.9,.3,1.1)' }),
        spr(1, [{ transform: `translateX(${unit() * 0.6}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 650, { easing: 'cubic-bezier(.2,.9,.3,1.1)' }),
        popup('⚔️ VS ⚔️', { x: unit() / 2, y: unit() * 0.36 }, { size: 0.9, color: '#e02828', rise: 0.02, dur: 1200 }),
      ]);
    }

    // K.O. del perdente e festa del vincitore (ev.side = vincitore)
    async function ko(ev) {
      const w = ev.side, l = 1 - w, lp = pos(l), wp = pos(w);
      await Promise.all([
        spr(l, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${lp.h * 0.5}px) rotate(${l === 1 ? 14 : -14}deg) scale(.8)`, opacity: 0 }], 1000, { fill: 'forwards', easing: 'ease-in' }),
        burst('💫', { x: lp.x, y: lp.y - lp.h * 0.2 }, { count: 6, radius: 0.1 }),
        sleep(500).then(() => Promise.all([
          spr(w, [{ transform: 'none' }, { transform: `translateY(${-wp.h * 0.12}px)` }, { transform: 'none' }, { transform: `translateY(${-wp.h * 0.08}px)` }, { transform: 'none' }], 900),
          burst(['🎉', '🎊', '✨', '🏆'], wp, { count: 12, radius: 0.22, size: 1, dur: 1200 }),
          popup('VITTORIA!', { x: unit() / 2, y: unit() * 0.36 }, { size: 0.8, color: '#e0a000', rise: 0.03, dur: 1500 }),
        ])),
      ]);
    }

    return {
      intro,
      async event(ev, ctx) {
        if (skipping()) return;
        switch (ev.kind) {
          case 'use': return attack(ev, ctx);
          case 'hit': return hit(ev, ctx);
          case 'miss': return miss(ev);
          case 'status': return status(ev);
          case 'fail': return popup('nessun effetto', pos(1 - ev.side), { size: 0.45, color: '#7a7a7a', lift: 30 });
          case 'skip': return skip(ev);
          case 'self': return selfHit(ev);
          case 'dot': return dot(ev);
          case 'cure': case 'wake': return cure(ev);
          case 'end': return ko(ev);
          default: return undefined;
        }
      },
      // interrompe tutto (Salta): rimuove le particelle e ferma le animazioni degli sprite
      stop() {
        layer.textContent = '';
        for (const s of sprites) s.getAnimations().forEach(a => a.cancel());
        gb.getAnimations().forEach(a => a.cancel());
      },
      reset() { this.stop(); },
    };
  }

  root.BattleFX = { create, TYPE_FX };
})(typeof window !== 'undefined' ? window : globalThis);
