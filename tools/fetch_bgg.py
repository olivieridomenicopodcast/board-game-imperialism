#!/usr/bin/env python3
"""Scarica da BoardGameGeek i dati dei giochi in data/games.json e genera data/bgg.json + data/bgg.js.

Uso: python3 tools/fetch_bgg.py [--refresh]
Con la cache in tools/.bgg_cache/ le esecuzioni successive non rifanno le richieste già riuscite.
"""
import json, os, sys, time, urllib.request, urllib.error
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".bgg_cache")
BATCH = 20
os.makedirs(CACHE, exist_ok=True)
refresh = "--refresh" in sys.argv

# Correzioni ai bgg_id sbagliati nel file sorgente: {id nel file: id BGG corretto}.
# data/id_fix.json è generato da tools/find_ids.py, data/id_fix_manual.json è scritto a mano e vince.
ID_FIX = {}
for name in ("id_fix.json", "id_fix_manual.json"):
    p = os.path.join(ROOT, "data", name)
    if os.path.exists(p):
        ID_FIX.update(json.load(open(p, encoding="utf-8")))

games = json.load(open(os.path.join(ROOT, "data", "games.json"), encoding="utf-8"))


def fetch(ids):
    key = os.path.join(CACHE, "_".join(ids) + ".xml")
    if not refresh and os.path.exists(key):
        return open(key, "rb").read()
    url = "https://boardgamegeek.com/xmlapi2/thing?stats=1&id=" + ",".join(ids)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "board-game-imperialism"}), timeout=60) as r:
                data = r.read()
            if r.status == 200 and b"<items" in data:
                open(key, "wb").write(data)
                return data
        except urllib.error.HTTPError as e:
            print("  HTTP", e.code, "- riprovo", file=sys.stderr)
        except Exception as e:
            print("  errore", e, "- riprovo", file=sys.stderr)
        time.sleep(3 * (attempt + 1))
    raise SystemExit("fallito: " + url)


def val(el, tag, cast=float, default=0):
    n = el.find(tag)
    if n is None or n.get("value") in (None, ""):
        return default
    try:
        return cast(n.get("value"))
    except ValueError:
        return default


out = {}
ids = [ID_FIX.get(g["id"], g["id"]) for g in games]
back = {ID_FIX.get(g["id"], g["id"]): g["id"] for g in games}
for i in range(0, len(ids), BATCH):
    chunk = ids[i:i + BATCH]
    print(f"{i + len(chunk)}/{len(ids)}", flush=True)
    root = ET.fromstring(fetch(chunk))
    for it in root.findall("item"):
        st = it.find("statistics/ratings")
        rank = None
        if st is not None:
            for r in st.findall("ranks/rank"):
                if r.get("name") == "boardgame" and r.get("value", "").isdigit():
                    rank = int(r.get("value"))
        out[back[it.get("id")]] = {
            "bggId": it.get("id"),
            "year": val(it, "yearpublished", int),
            "minPlayers": val(it, "minplayers", int),
            "maxPlayers": val(it, "maxplayers", int),
            "playTime": val(it, "playingtime", int),
            "minAge": val(it, "minage", int),
            "rating": round(val(st, "average"), 2) if st is not None else 0,
            "bayes": round(val(st, "bayesaverage"), 2) if st is not None else 0,
            "votes": val(st, "usersrated", int) if st is not None else 0,
            "weight": round(val(st, "averageweight"), 2) if st is not None else 0,
            "rank": rank,
            "categories": [l.get("value") for l in it.findall("link[@type='boardgamecategory']")],
            "mechanics": [l.get("value") for l in it.findall("link[@type='boardgamemechanic']")],
        }
    time.sleep(1.5)

for v in out.values():
    for k in ("weight", "rating", "bayes", "playTime", "maxPlayers", "year"):
        if not v[k]:
            v[k] = None

missing = [g["id"] for g in games if g["id"] not in out]
json.dump(out, open(os.path.join(ROOT, "data", "bgg.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(ROOT, "data", "bgg.js"), "w", encoding="utf-8") as f:
    f.write("window.BGG=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
nulls = {k: sum(1 for v in out.values() if v[k] is None) for k in ("weight", "rating", "playTime", "maxPlayers")}
print("ok:", len(out), "giochi; mancanti:", missing, "; dati vuoti (null):", nulls)
