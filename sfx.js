'use strict';
// Effetti sonori. Nessun file necessario: i suoni sono generati con la Web Audio API (stile Game Boy).
// Se esiste audio/sfx/<nome>.mp3 (o .ogg / .wav) viene usato al posto del suono generato: vedi audio/sfx/LEGGIMI.txt.
// Sfx.play(nome) | Sfx.event(ev, {move, fighters}) per gli eventi della lotta | Sfx.enabled (attivo/muto, ricordato).
(function (root) {
  const get = (k, d) => { try { const v = localStorage.getItem('bgi.opt.' + k); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('bgi.opt.' + k, v); } catch (e) { /* ok */ } };
  let enabled = get('sfxOn', '1') === '1';
  let ctx = null, master = null, noiseBuf = null;

  function ac() {
    if (ctx) return ctx;
    const C = root.AudioContext || root.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume(); }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, unlock, true);

  // ---- mattoni ----
  // nota: forma d'onda, frequenza iniziale -> finale (glissando), durata, volume, ritardo
  function tone(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.12, vol = o.vol === undefined ? 0.4 : o.vol;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.f0 * 0.05; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  // rumore filtrato (colpi, fruscii)
  function noise(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.15, vol = o.vol === undefined ? 0.4 : o.vol;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const seq = (type, notes, step, dur, vol) => notes.forEach((f, i) => tone({ type, f0: f, dur, vol, at: i * step }));

  // ---- suoni ----
  const S = {
    click:    () => tone({ f0: 880, f1: 660, dur: 0.05, vol: 0.25 }),
    tick:     () => tone({ f0: 1300, dur: 0.03, vol: 0.18 }),               // sorteggio: salto di selezione
    compass:  () => tone({ type: 'triangle', f0: 700, dur: 0.05, vol: 0.25 }),
    bannerAtk: () => { seq('square', [523, 659, 784], 0.09, 0.14, 0.3); tone({ type: 'square', f0: 1046, dur: 0.3, vol: 0.3, at: 0.27 }); },
    bannerDef: () => { seq('square', [392, 330], 0.12, 0.18, 0.3); tone({ type: 'sawtooth', f0: 196, dur: 0.3, vol: 0.25, at: 0.24 }); },
    arrow:    () => { noise({ filter: 'bandpass', f0: 500, f1: 3500, dur: 0.9, vol: 0.25 }); tone({ type: 'sawtooth', f0: 180, f1: 900, dur: 0.9, vol: 0.12 }); },
    intro:    () => { noise({ filter: 'bandpass', f0: 400, f1: 2500, dur: 0.4, vol: 0.25 }); seq('square', [392, 523], 0.15, 0.2, 0.25); },
    conquer:  () => { seq('square', [523, 659, 784, 1046], 0.08, 0.16, 0.28); tone({ type: 'triangle', f0: 262, dur: 0.5, vol: 0.3 }); },
    hp:       () => tone({ f0: 1100, dur: 0.025, vol: 0.12 }),
    // colpi
    hit:      () => { noise({ f0: 2500, f1: 300, dur: 0.16, vol: 0.5 }); tone({ type: 'square', f0: 220, f1: 80, dur: 0.14, vol: 0.3 }); },
    hitSuper: () => { noise({ f0: 5000, f1: 300, dur: 0.28, vol: 0.6 }); tone({ type: 'square', f0: 300, f1: 60, dur: 0.24, vol: 0.4 }); tone({ type: 'square', f0: 1200, f1: 2400, dur: 0.12, vol: 0.2, at: 0.05 }); },
    hitWeak:  () => { noise({ f0: 800, f1: 200, dur: 0.14, vol: 0.28 }); tone({ type: 'triangle', f0: 120, f1: 70, dur: 0.14, vol: 0.3 }); },
    crit:     () => { noise({ f0: 6000, f1: 400, dur: 0.3, vol: 0.6 }); tone({ type: 'square', f0: 160, f1: 40, dur: 0.3, vol: 0.4 }); seq('square', [1568, 2093], 0.06, 0.1, 0.22); },
    miss:     () => noise({ filter: 'bandpass', f0: 2500, f1: 400, dur: 0.3, vol: 0.25 }),
    fail:     () => seq('square', [220, 196], 0.09, 0.12, 0.2),
    self:     () => { S.hit(); tone({ type: 'sawtooth', f0: 400, f1: 150, dur: 0.3, vol: 0.2, vib: 25 }); },
    dot:      () => { tone({ type: 'triangle', f0: 600, f1: 200, dur: 0.25, vol: 0.3 }); noise({ f0: 1500, f1: 300, dur: 0.15, vol: 0.2 }); },
    cure:     () => seq('triangle', [659, 880, 1174], 0.08, 0.14, 0.3),
    skip:     () => seq('triangle', [330, 294, 262], 0.12, 0.16, 0.22),
    // condizioni
    st_paralisi:   () => { tone({ type: 'sawtooth', f0: 90, dur: 0.5, vol: 0.3, vib: 30 }); noise({ f0: 3000, f1: 800, dur: 0.5, vol: 0.2 }); },
    st_sonno:      () => seq('triangle', [523, 494, 440, 392, 330], 0.14, 0.24, 0.28),
    st_confusione: () => tone({ type: 'sine', f0: 500, f1: 500, dur: 0.6, vol: 0.35, vib: 9 }),
    st_debito:     () => { seq('square', [988, 1319], 0.07, 0.12, 0.25); seq('square', [440, 330, 247], 0.1, 0.16, 0.25); },
    st_sabotaggio: () => { noise({ filter: 'bandpass', f0: 1800, f1: 900, dur: 0.3, vol: 0.4 }); tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.4, vol: 0.3 }); },
    // K.O. e vittorie
    ko:       () => { tone({ type: 'square', f0: 500, f1: 60, dur: 0.9, vol: 0.4 }); noise({ f0: 2000, f1: 100, dur: 0.9, vol: 0.3 }); },
    win:      () => { seq('square', [523, 523, 523, 659, 784], 0.13, 0.2, 0.3); tone({ type: 'triangle', f0: 262, dur: 0.9, vol: 0.3 }); },
    victory:  () => { seq('square', [523, 659, 784, 1046, 784, 1046, 1318], 0.14, 0.3, 0.3); seq('triangle', [262, 330, 392, 523], 0.28, 0.5, 0.3); },
    // mosse neutre e di stato
    neutral:  () => { for (let i = 0; i < 4; i++) noise({ f0: 4000, dur: 0.05, vol: 0.3, at: i * 0.07, filter: 'highpass' }); tone({ f0: 660, dur: 0.1, vol: 0.2, at: 0.3 }); },
    statusUse: () => { tone({ type: 'sine', f0: 400, f1: 900, dur: 0.35, vol: 0.3, vib: 14 }); tone({ type: 'triangle', f0: 800, f1: 300, dur: 0.3, vol: 0.2, at: 0.3 }); },
  };
  // una voce per ogni tipo di gioco (mossa del tipo)
  const TYPE = {
    Strategia:     p => { seq('square', [330, 392, 494], 0.07, 0.1, 0.3); noise({ f0: 1500, dur: 0.1, vol: 0.3, at: 0.2 }); },
    Astratto:      p => { tone({ type: 'triangle', f0: 1568, dur: 0.15, vol: 0.35 }); tone({ type: 'triangle', f0: 1175, dur: 0.15, vol: 0.3, at: 0.1 }); },
    Gestionale:    p => { for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', f0: 140 + (i % 2) * 40, dur: 0.06, vol: 0.3, at: i * 0.08 }); },
    Economia:      p => { tone({ f0: 988, dur: 0.07, vol: 0.3 }); tone({ f0: 1319, dur: 0.3, vol: 0.3, at: 0.07 }); },
    Guerra:        p => { noise({ f0: 3000, f1: 150, dur: 0.4, vol: 0.55 }); tone({ type: 'sawtooth', f0: 120, f1: 45, dur: 0.4, vol: 0.4 }); },
    Deduzione:     p => { tone({ type: 'sine', f0: 400, f1: 800, dur: 0.25, vol: 0.35 }); tone({ type: 'sine', f0: 900, dur: 0.15, vol: 0.3, at: 0.28 }); },
    Cooperativo:   p => { [523, 659, 784].forEach(f => tone({ type: 'triangle', f0: f, dur: 0.35, vol: 0.25 })); },
    Ambientazione: p => { seq('triangle', [523, 659, 784, 1046, 1318], 0.05, 0.2, 0.25); noise({ filter: 'highpass', f0: 6000, dur: 0.3, vol: 0.12 }); },
    Carte:         p => { for (let i = 0; i < 3; i++) noise({ filter: 'highpass', f0: 3500, dur: 0.06, vol: 0.4, at: i * 0.06 }); },
    Fortuna:       p => { for (let i = 0; i < 5; i++) noise({ filter: 'bandpass', f0: 2500 + i * 300, dur: 0.04, vol: 0.35, at: i * 0.05 }); tone({ f0: 1568, dur: 0.15, vol: 0.25, at: 0.3 }); },
    Party:         p => { tone({ type: 'sine', f0: 400, f1: 1800, dur: 0.3, vol: 0.35 }); noise({ f0: 4000, dur: 0.08, vol: 0.3, at: 0.32 }); },
    Bambini:       p => { seq('triangle', [784, 988, 784, 1175], 0.09, 0.12, 0.3); },
  };

  // ---- file opzionali: audio/sfx/<nome>.mp3 sostituisce il suono generato ----
  const files = {};            // nome -> Audio | false (non esiste)
  function fileFor(name) {
    if (name in files) return files[name];
    const a = new Audio();
    files[name] = a;
    a.preload = 'auto';
    a.addEventListener('error', () => { files[name] = false; });
    a.src = `audio/sfx/${name}.mp3`;
    return a;
  }
  function tryFile(name) {
    const a = fileFor(name);
    if (!a || a.error || a.readyState < 2) return false;
    const c = a.cloneNode(); c.volume = 0.8; c.play().catch(() => {});
    return true;
  }

  function play(name, arg) {
    if (!enabled) return;
    if (!ac()) return;
    if (ctx.state === 'suspended') return;            // niente tocco ancora: il browser non permette l'audio
    if (tryFile(name)) return;
    try {
      if (name.startsWith('use_')) { const f = TYPE[name.slice(4)]; if (f) f(arg); return; }
      if (S[name]) S[name](arg);
    } catch (e) { /* non blocca mai il gioco */ }
  }

  // eventi della lotta -> suono
  function event(ev, c) {
    switch (ev.kind) {
      case 'intro': return play('intro');
      case 'use': {
        const m = c && c.move, f = c && c.fighters && c.fighters[ev.side];
        if (!m) return;
        if (m.kind === 'status') return play('statusUse');
        if (m.kind === 'neutral') return play('neutral');
        return play('use_' + (f ? f.type : 'Strategia'));
      }
      case 'hit': return play(ev.crit ? 'crit' : ev.eff === 'super' ? 'hitSuper' : ev.eff === 'weak' ? 'hitWeak' : 'hit');
      case 'miss': return play('miss');
      case 'fail': return play('fail');
      case 'status': return play('st_' + ev.status);
      case 'skip': return play('skip');
      case 'self': return play('self');
      case 'dot': return play('dot');
      case 'cure': case 'wake': return play('cure');
      case 'end': play('ko'); setTimeout(() => play('win'), 900);
    }
  }

  let last = 0;
  function hp() { const n = performance.now(); if (n - last > 55) { last = n; play('hp'); } }   // barra HP che cala

  // click su qualunque pulsante
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) play('click'); }, true);

  root.Sfx = { play, event, hp, get enabled() { return enabled; }, set enabled(v) { enabled = !!v; put('sfxOn', enabled ? '1' : '0'); } };
})(window);
