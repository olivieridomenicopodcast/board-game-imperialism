'use strict';
// Finestre di dialogo in stile gioco (al posto di confirm/prompt del browser).
// Dialog.choose(msg, buttons) | confirm(msg, opts) | prompt(msg, valore) | form(titolo, campi) | toast(testo)
(function (root) {
  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // Costruisce la finestra e ritorna una promise risolta dal pulsante scelto (o null con Esc/annulla).
  function open({ title, message, fields = [], buttons }) {
    return new Promise(resolve => {
      const back = h('div', 'dlg-back', document.body);
      const box = h('div', 'dlg', back);
      box.setAttribute('role', 'dialog');
      if (title) h('h3', '', box, title);
      if (message) h('p', 'dlg-msg', box, message);
      const inputs = {};
      for (const f of fields) {
        const label = h('label', 'dlg-field', box);
        h('span', '', label, f.label);
        let input;
        if (f.type === 'select') {
          input = h('select', '', label);
          for (const o of f.options) { const op = h('option', '', input, o.label); op.value = o.value; }
        } else {
          input = h('input', '', label);
          input.type = f.type || 'text';
          if (f.placeholder) input.placeholder = f.placeholder;
          input.autocomplete = 'off';
        }
        input.value = f.value || '';
        inputs[f.name] = input;
        if (f.hint) h('small', '', label, f.hint);
        if (f.hintFn) {                                   // suggerimento che si aggiorna con il valore scelto
          const small = h('small', 'dlg-live', label, f.hintFn(input.value));
          input.addEventListener('input', () => { small.textContent = f.hintFn(input.value); });
        }
      }
      const row = h('div', 'dlg-btns', box);
      const values = () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
      const done = v => { document.removeEventListener('keydown', onKey, true); back.remove(); resolve(v); };
      let primary = null;
      for (const b of buttons) {
        const btn = h('button', 'dlg-btn ' + (b.kind || ''), row, b.label);
        btn.type = 'button';
        btn.onclick = () => done(b.value === 'form' ? values() : b.value);
        if (b.kind === 'primary' || b.kind === 'danger') primary = primary || btn;
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && primary && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); primary.click(); }
      }
      document.addEventListener('keydown', onKey, true);
      const first = Object.values(inputs)[0] || row.querySelector('.primary, .danger') || row.lastChild;
      if (first) { first.focus(); if (first.select) first.select(); }
    });
  }

  const api = {
    choose(message, buttons, title) { return open({ title, message, buttons }); },
    async confirm(message, { okLabel = 'Sì', cancelLabel = 'Annulla', danger = false, title } = {}) {
      const r = await open({ title, message, buttons: [
        { label: cancelLabel, value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' }] });
      return r === true;
    },
    async prompt(message, value = '', title) {
      const r = await open({ title, message, fields: [{ name: 'v', label: '', value }], buttons: [
        { label: 'Annulla', value: null }, { label: 'OK', value: 'form', kind: 'primary' }] });
      return r === null ? null : r.v.trim();
    },
    // campi: [{name,label,value,type,hint,placeholder}] -> {name: valore} oppure null
    form(title, fields, okLabel = 'Salva') {
      return open({ title, fields, buttons: [{ label: 'Annulla', value: null }, { label: okLabel, value: 'form', kind: 'primary' }] });
    },
    toast(text, ms = 2600) {
      let box = document.getElementById('toasts');
      if (!box) { box = h('div', '', document.body); box.id = 'toasts'; }
      const t = h('div', 'toast', box, text);
      setTimeout(() => t.remove(), ms);
    },
  };
  root.Dialog = api;
})(window);
