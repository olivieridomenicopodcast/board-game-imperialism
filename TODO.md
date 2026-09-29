# TODO

- [ ] **Copertine da correggere (da PC)**: per 37 giochi il `bgg_id` del file sorgente era sbagliato e la copertina in `covers/` è ancora quella vecchia.
  Da un PC con accesso normale a BGG: `pip install pillow && python3 tools/fetch_covers.py`, poi commit di `covers/`.
  L'elenco dei giochi corretti è in `tools/id_report.json` e `data/id_fix*.json`.
- [ ] Domino, Wolfsburg, Trivial Pursuit: `bgg_id` da trovare (ora usano stat stimate).
- [ ] Rivedere la tabella dei vantaggi tra tipi (`data/types.js`) e le assegnazioni dei tipi (`data/type_overrides.json`).
- [x] Passo 6: lotta automatica (battle.js, data/moves.js, tools/simulate.js)
- [x] Passo 7: schermata di lotta stile Game Boy (battle-ui.js, battle.css)
- [x] Passo 8: campagne multiple, salvataggio automatico, sync GitHub (storage.js, sync.js, menu.js, dialog.js)
- [ ] Correzioni di tipo fatte dalla scheda (salvate nel browser): esportale dal Dex (⬇ Esporta correzioni tipi) e portale in `data/type_overrides.json`.
- [ ] Se cambi stat, tipi o mosse (anche dalla scheda), rilancia `node tools/balance.js 0.22` per rigenerare `data/balance.js` (bonus di bilanciamento).
- [ ] Sul PC: `git config core.hooksPath .githooks` (una volta), così anche i tuoi commit incrementano il numero di build mostrato nel menù.
- Hall of Fame: le statistiche partono dalle campagne create dalla build 34 in poi (campo `stats`); le vecchie non contano. Le copie di una campagna partono da statistiche vuote per non contare due volte.
- Titoli: 👑n accanto al nome (titoli per quella dimensione di griglia), corona sopra la copertina/sprite per il campione in carica; i vincitori delle campagne precedenti di quella dimensione sono obbligati a partecipare (max 20% della mappa). Contano solo campagne con `stats` (build 34+).
