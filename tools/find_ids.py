#!/usr/bin/env python3
"""Cerca su BGG, per nome, l'id giusto di ogni gioco e propone correzioni ai bgg_id sbagliati del file sorgente.

Uso: python3 tools/find_ids.py
Per ogni gioco cerca il nome esatto su BGG, tra i candidati (solo giochi base) sceglie quello con più voti.
Propone una correzione solo se l'id attuale ha molti meno voti del migliore candidato.
Scrive: tools/id_report.json (tutte le proposte) e data/id_fix.json (correzioni {id nel file: id BGG}).
Le correzioni fatte a mano in data/id_fix_manual.json hanno la precedenza e non vengono toccate.
"""
import json, os, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".bgg_cache")
os.makedirs(CACHE, exist_ok=True)
games = json.load(open(os.path.join(ROOT, "data", "games.json"), encoding="utf-8"))
bgg = json.load(open(os.path.join(ROOT, "data", "bgg.json"), encoding="utf-8"))
manual_path = os.path.join(ROOT, "data", "id_fix_manual.json")
manual = json.load(open(manual_path, encoding="utf-8")) if os.path.exists(manual_path) else {}


def get(url, cache_name):
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        return open(path, "rb").read()
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "board-game-imperialism"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if b"<items" in data:
                open(path, "wb").write(data)
                time.sleep(1.0)
                return data
        except Exception as e:
            print("  riprovo:", e)
        time.sleep(3 * (attempt + 1))
    raise SystemExit("fallito " + url)


def norm(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


def votes_of(ids):
    """id -> (usersrated, nome primario, anno) per le richieste thing a blocchi."""
    out = {}
    ids = sorted(set(ids), key=int)
    for i in range(0, len(ids), 20):
        chunk = ids[i:i + 20]
        data = get("https://boardgamegeek.com/xmlapi2/thing?stats=1&id=" + ",".join(chunk),
                   "vt_" + "_".join(chunk) + ".xml")
        for it in ET.fromstring(data).findall("item"):
            st = it.find("statistics/ratings/usersrated")
            y = it.find("yearpublished")
            out[it.get("id")] = (int(st.get("value")) if st is not None else 0,
                                 it.find("name[@type='primary']").get("value"),
                                 y.get("value") if y is not None else "")
    return out


# 1) ricerca per nome
cands = {}
for i, g in enumerate(games, 1):
    q = urllib.parse.quote(g["name"])
    data = get(f"https://boardgamegeek.com/xmlapi2/search?type=boardgame&exact=1&query={q}", f"s_{g['id']}.xml")
    cands[g["id"]] = [it.get("id") for it in ET.fromstring(data).findall("item")]
    if i % 50 == 0:
        print("ricerca", i, "/", len(games), flush=True)

# 2) voti dei candidati
allids = {c for l in cands.values() for c in l} | {bgg[g["id"]]["bggId"] for g in games}
info = votes_of(allids)

report, fixes = {}, {}
for g in games:
    gid = g["id"]
    cur = bgg[gid]["bggId"]
    if gid in manual:
        continue
    cl = [c for c in cands[gid] if c in info]
    if not cl:
        continue
    best = max(cl, key=lambda c: info[c][0])
    cur_votes = info.get(cur, (0,))[0]
    if best != cur and info[best][0] > max(3 * cur_votes, 50):
        report[gid] = {"n": g["n"], "name": g["name"], "old": cur, "old_bgg_name": info.get(cur, ("", "?"))[1],
                       "old_votes": cur_votes, "new": best, "new_name": info[best][1], "new_year": info[best][2],
                       "new_votes": info[best][0]}
        fixes[gid] = best

json.dump(report, open(os.path.join(ROOT, "tools", "id_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(fixes, open(os.path.join(ROOT, "data", "id_fix.json"), "w", encoding="utf-8"), indent=1)
print(len(fixes), "correzioni proposte")
