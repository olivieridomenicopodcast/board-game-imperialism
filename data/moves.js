// Set fisso di mosse (niente mosse ad hoc per gioco). Ogni gioco ne ha 3:
//   1 mossa del proprio tipo (una delle 3 del tipo), 1 neutra, 1 di stato.
// power = potenza, acc = precisione (%). I nomi sono riferimenti a giochi da tavolo.
window.TYPE_MOVES = {
  Strategia:     [{ name: 'Apertura Solida', power: 55, acc: 100 }, { name: 'Manovra Accerchiante', power: 70, acc: 95 }, { name: 'Piano Maestro', power: 85, acc: 90 }],
  Astratto:      [{ name: 'Pedina Avanzata', power: 55, acc: 100 }, { name: 'Salto Doppio', power: 70, acc: 95 }, { name: 'Scacco al Re', power: 85, acc: 90 }],
  Gestionale:    [{ name: 'Piazzamento Lavoratore', power: 55, acc: 100 }, { name: 'Catena di Produzione', power: 70, acc: 95 }, { name: 'Motore Perfetto', power: 85, acc: 90 }],
  Economia:      [{ name: 'Asta al Rialzo', power: 55, acc: 100 }, { name: 'Monopolio', power: 70, acc: 95 }, { name: 'Crollo di Borsa', power: 85, acc: 90 }],
  Guerra:        [{ name: 'Attacco di Pedine', power: 55, acc: 100 }, { name: 'Carica di Cavalleria', power: 70, acc: 95 }, { name: 'Offensiva Totale', power: 85, acc: 90 }],
  Deduzione:     [{ name: 'Domanda Indiscreta', power: 55, acc: 100 }, { name: 'Bluff Riuscito', power: 70, acc: 95 }, { name: "J'Accuse!", power: 85, acc: 90 }],
  Cooperativo:   [{ name: 'Aiuto Reciproco', power: 55, acc: 100 }, { name: 'Fronte Comune', power: 70, acc: 95 }, { name: 'Vittoria di Squadra', power: 85, acc: 90 }],
  Ambientazione: [{ name: 'Colpo di Spada', power: 55, acc: 100 }, { name: 'Incantesimo', power: 70, acc: 95 }, { name: 'Boss Finale', power: 85, acc: 90 }],
  Carte:         [{ name: 'Carta Pescata', power: 55, acc: 100 }, { name: 'Combo di Carte', power: 70, acc: 95 }, { name: 'Mano Vincente', power: 85, acc: 90 }],
  Fortuna:       [{ name: 'Tiro Fortunato', power: 55, acc: 100 }, { name: 'Doppio Sei', power: 70, acc: 95 }, { name: 'Jackpot', power: 85, acc: 90 }],
  Party:         [{ name: 'Risata Contagiosa', power: 55, acc: 100 }, { name: 'Indovina Chi Sono', power: 70, acc: 95 }, { name: 'Brindisi Finale', power: 85, acc: 90 }],
  Bambini:       [{ name: 'Girotondo', power: 55, acc: 100 }, { name: 'Palla Colorata', power: 70, acc: 95 }, { name: 'Grande Festa', power: 85, acc: 90 }],
};

// Mosse neutre: nessun tipo, quindi nessun vantaggio/svantaggio.
window.NEUTRAL_MOVES = [
  { name: 'Tira i Dadi', power: 50, acc: 100 },
  { name: 'Pesca una Carta', power: 55, acc: 100 },
  { name: 'Regola della Casa', power: 65, acc: 95 },
  { name: 'Cambio di Piano', power: 40, acc: 100 },
  { name: 'Partita a Oltranza', power: 80, acc: 85 },
];

// Condizioni (una alla volta per gioco). turns = [min, max] turni di durata.
window.STATUSES = {
  paralisi:   { label: 'Analysis Paralysis', move: 'Analysis Paralysis', acc: 85, turns: [3, 5], note: '35% di saltare il turno' },
  sonno:      { label: 'Serata Infinita',    move: 'Serata Infinita',    acc: 70, turns: [1, 2], note: 'salta il turno' },
  confusione: { label: 'Regole Confuse',     move: 'Regole Confuse',     acc: 85, turns: [2, 4], note: '33% di colpire sé stesso' },
  debito:     { label: 'Debito',             move: 'Tassa Salata',       acc: 85, turns: [4, 5], note: 'perde 1/10 degli HP ogni turno' },
  sabotaggio: { label: 'Sabotaggio',         move: 'Sabotaggio',         acc: 90, turns: [4, 4], note: 'attacco -35%' },
};

// Due condizioni possibili per tipo (una viene scelta in modo fisso per ogni gioco).
window.TYPE_STATUS = {
  Strategia: ['sabotaggio', 'paralisi'], Astratto: ['paralisi', 'confusione'], Gestionale: ['debito', 'paralisi'],
  Economia: ['debito', 'sabotaggio'], Guerra: ['sabotaggio', 'debito'], Deduzione: ['confusione', 'paralisi'],
  Cooperativo: ['sabotaggio', 'sonno'], Ambientazione: ['sonno', 'confusione'], Carte: ['confusione', 'sabotaggio'],
  Fortuna: ['confusione', 'sonno'], Party: ['sonno', 'confusione'], Bambini: ['sonno', 'paralisi'],
};
