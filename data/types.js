// 12 tipi e tabella dei vantaggi. "beats": il tipo colpisce SUPER EFFICACE questi tre;
// per simmetria è poco efficace contro i tre che lo battono. Il resto è neutro.
// Per cambiare un matchup basta modificare gli elenchi qui sotto (ogni tipo dovrebbe battere 3 tipi ed essere battuto da 3).
window.TYPES = [
  { id: 'Strategia',     icon: '♟️', color: '#5b6ee1', hint: 'Piani a lungo termine, controllo del territorio' },
  { id: 'Astratto',      icon: '🔷', color: '#7f8c8d', hint: 'Regole pure, zero tema (scacchi, Go, Azul)' },
  { id: 'Gestionale',    icon: '⚙️', color: '#2e8b57', hint: 'Motori e piazzamento lavoratori (Agricola, Caylus)' },
  { id: 'Economia',      icon: '💰', color: '#d4a017', hint: 'Mercato, aste, commercio (Monopoly, Brass)' },
  { id: 'Guerra',        icon: '⚔️', color: '#c0392b', hint: 'Conflitto diretto e wargame (Risiko, Root)' },
  { id: 'Deduzione',     icon: '🔍', color: '#8e44ad', hint: 'Indizi, bluff, ruoli nascosti (Cluedo, Bang!)' },
  { id: 'Cooperativo',   icon: '🤝', color: '#16a085', hint: 'Tutti insieme contro il gioco (Pandemic)' },
  { id: 'Ambientazione', icon: '🐉', color: '#e67e22', hint: 'Tema forte, campagne e avventure (Gloomhaven)' },
  { id: 'Carte',         icon: '🃏', color: '#e84393', hint: 'Mazzi e mano di carte (Love Letter, Munchkin)' },
  { id: 'Fortuna',       icon: '🎲', color: '#f1c40f', hint: 'Dadi e caso (Yahtzee, Il Gioco della Vita)' },
  { id: 'Party',         icon: '🎉', color: '#ff6f61', hint: 'Giochi da tavolata, risate (Dixit, Taboo)' },
  { id: 'Bambini',       icon: '🧸', color: '#48c9b0', hint: 'Facili e veloci per i più piccoli (Candy Land)' },
];

window.TYPE_BEATS = {
  Fortuna:       ['Party', 'Bambini', 'Carte'],
  Party:         ['Bambini', 'Carte', 'Deduzione'],
  Bambini:       ['Carte', 'Deduzione', 'Cooperativo'],
  Carte:         ['Deduzione', 'Cooperativo', 'Ambientazione'],
  Deduzione:     ['Cooperativo', 'Ambientazione', 'Guerra'],
  Cooperativo:   ['Ambientazione', 'Guerra', 'Strategia'],
  Ambientazione: ['Guerra', 'Strategia', 'Astratto'],
  Guerra:        ['Strategia', 'Astratto', 'Gestionale'],
  Strategia:     ['Astratto', 'Gestionale', 'Economia'],
  Astratto:      ['Gestionale', 'Economia', 'Fortuna'],
  Gestionale:    ['Economia', 'Fortuna', 'Party'],
  Economia:      ['Fortuna', 'Party', 'Bambini'],
};

window.TYPE_MULT = { super: 1.5, weak: 1 / 1.5 };

// moltiplicatore di danno del tipo attaccante contro il tipo difensore
window.typeMultiplier = function (att, def) {
  if ((window.TYPE_BEATS[att] || []).includes(def)) return window.TYPE_MULT.super;
  if ((window.TYPE_BEATS[def] || []).includes(att)) return window.TYPE_MULT.weak;
  return 1;
};
