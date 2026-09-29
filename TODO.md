# TODO

- [ ] **Copertine da correggere (da PC)**: per 28 giochi il `bgg_id` del file sorgente era sbagliato e la copertina in `covers/` è ancora quella vecchia.
  Da un PC con accesso normale a BGG: `pip install pillow && python3 tools/fetch_covers.py`, poi commit di `covers/`.
  L'elenco dei giochi corretti è in `tools/id_report.json` e `data/id_fix*.json`.
- [ ] Domino, Wolfsburg, Trivial Pursuit: `bgg_id` da trovare (ora usano stat stimate).
- [ ] Rivedere la tabella dei vantaggi tra tipi (`data/types.js`) e le assegnazioni dei tipi (`data/type_overrides.json`).
- [x] Passo 6: lotta automatica (battle.js, data/moves.js, tools/simulate.js)
- [x] Passo 7: schermata di lotta stile Game Boy (battle-ui.js, battle.css)
- [x] Passo 8: campagne multiple, salvataggio automatico, sync GitHub (storage.js, sync.js, menu.js, dialog.js)
