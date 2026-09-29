'use strict';
// Musica di sottofondo: audio/menu.mp3 (menù), audio/mappa.mp3 (campagna e sorteggio), audio/lotta.mp3 (lotte).
// La traccia giusta si sceglie guardando quale schermata è visibile; passaggio con dissolvenza.
// I browser bloccano l'audio finché non c'è un tocco/clic: la musica parte al primo.
// Se un file manca resta il silenzio. Volume e muto sono ricordati (localStorage bgi.opt.music*).
(function (root) {
  const TRACKS = { menu: 'audio/menu.mp3', mappa: 'audio/mappa.mp3', lotta: 'audio/lotta.mp3' };
  const FADE_MS = 700, TICK = 50;
  const get = (k, d) => { try { const v = localStorage.getItem('bgi.opt.' + k); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('bgi.opt.' + k, v); } catch (e) { /* ok */ } };

  let volume = Math.min(1, Math.max(0, +get('musicVol', 0.5))), muted = get('musicMute', '0') === '1';
  let unlocked = false, want = 'menu';
  const els = {};           // nome -> {a: Audio, level: 0..1 (dissolvenza), goal}
  const target = () => (muted ? 0 : volume);

  function track(name) {
    if (!els[name]) {
      const a = new Audio(TRACKS[name]);
      a.loop = true; a.preload = 'auto'; a.volume = 0;
      els[name] = { a, level: 0, goal: 0 };
    }
    return els[name];
  }

  function current() {
    const bs = document.querySelector('.bs');
    if (bs && !bs.classList.contains('hidden')) return 'lotta';
    const gv = document.getElementById('gameView');
    return gv && !gv.hidden ? 'mappa' : 'menu';
  }

  function step() {
    want = current();
    for (const name of Object.keys(TRACKS)) {
      if (name !== want && !els[name]) continue;
      const t = track(name);
      t.goal = name === want ? 1 : 0;
      const d = TICK / FADE_MS;
      t.level = t.goal > t.level ? Math.min(t.goal, t.level + d) : Math.max(t.goal, t.level - d);
      t.a.volume = Math.max(0, Math.min(1, t.level * target()));
      if (!unlocked) continue;
      if (t.goal === 1 && t.a.paused) t.a.play().catch(() => { /* manca il file o non ancora consentito */ });
      if (t.goal === 0 && t.level === 0 && !t.a.paused) { t.a.pause(); t.a.currentTime = 0; }
    }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    for (const ev of ['pointerdown', 'keydown', 'touchend']) document.removeEventListener(ev, unlock, true);
    step();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, unlock, true);
  setInterval(step, TICK);

  // pulsante 🔊/🔇 + volume, in alto a destra (sempre visibile)
  function ui() {
    const box = document.createElement('div');
    box.className = 'musicbar';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'iconbtn'; btn.title = 'Musica: attiva/muto';
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(volume * 100); vol.title = 'Volume musica';
    const paint = () => { btn.textContent = muted || volume === 0 ? '🔇' : '🔊'; };
    btn.onclick = () => { muted = !muted; put('musicMute', muted ? '1' : '0'); paint(); };
    vol.oninput = () => { volume = vol.value / 100; if (muted && volume > 0) { muted = false; put('musicMute', '0'); } put('musicVol', volume); paint(); };
    paint();
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 'iconbtn'; sb.title = 'Effetti sonori: attivi/muti';
    const sp = () => { sb.textContent = Sfx.enabled ? '🔔' : '🔕'; };
    sb.onclick = () => { Sfx.enabled = !Sfx.enabled; sp(); };
    sp();
    box.append(btn, vol, sb);
    document.body.appendChild(box);
  }
  if (document.body) ui(); else document.addEventListener('DOMContentLoaded', ui);

  root.Music = { get volume() { return volume; }, get muted() { return muted; } };
})(window);
