#!/usr/bin/env python3
"""Riscarica da BGG le copertine dei giochi il cui bgg_id è stato corretto (data/id_fix*.json).

Uso:
  python3 tools/fetch_covers.py              scarica le copertine e le salva in covers/<id>.jpg
  python3 tools/fetch_covers.py --dry-run    mostra solo quali giochi verrebbero aggiornati
  python3 tools/fetch_covers.py --urls-only  ricostruisce data/cover_urls.json dall'API di BGG (serve BGG_TOKEN se BGG lo richiede)

Gli indirizzi delle immagini sono già in data/cover_urls.json: di norma il download non usa l'API di BGG.
Richiede Pillow (pip install pillow).
"""
import io, json, os, sys, time, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "board-game-imperialism"}
URLS_PATH = os.path.join(ROOT, "data", "cover_urls.json")

fix = {}
for name in ("id_fix.json", "id_fix_manual.json"):
    p = os.path.join(ROOT, "data", name)
    if os.path.exists(p):
        fix.update(json.load(open(p, encoding="utf-8")))
games = {g["id"]: g for g in json.load(open(os.path.join(ROOT, "data", "games.json"), encoding="utf-8"))}
urls = json.load(open(URLS_PATH, encoding="utf-8")) if os.path.exists(URLS_PATH) else {}


def get(url, api=False):
    headers = dict(UA)
    if api and os.environ.get("BGG_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["BGG_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
        return r.read()


def rebuild_urls():
    """Chiede a BGG l'indirizzo della miniatura di ogni gioco corretto."""
    items = list(fix.items())
    for i in range(0, len(items), 20):
        chunk = items[i:i + 20]
        xml = get("https://boardgamegeek.com/xmlapi2/thing?id=" + ",".join(b for _, b in chunk), api=True)
        found = {it.get("id"): (it.findtext("thumbnail") or "").strip() for it in ET.fromstring(xml).findall("item")}
        for gid, bid in chunk:
            if found.get(bid):
                urls[gid] = found[bid]
        time.sleep(1)
    json.dump(urls, open(URLS_PATH, "w", encoding="utf-8"), indent=1)
    print("indirizzi salvati in data/cover_urls.json:", len(urls))


args = set(sys.argv[1:])
if "--urls-only" in args or any(gid not in urls for gid in fix):
    if "--dry-run" not in args:
        rebuild_urls()

print(f"{len(fix)} giochi con bgg_id corretto:")
for gid in sorted(fix, key=lambda k: games[k]["n"]):
    print(f"  #{games[gid]['n']:>3} {games[gid]['name']}")
if "--dry-run" in args or "--urls-only" in args:
    raise SystemExit(0)

from PIL import Image  # noqa: E402  (importata qui così --dry-run funziona anche senza Pillow)

os.makedirs(os.path.join(ROOT, "covers"), exist_ok=True)
ok, bad = 0, []
for gid in fix:
    url = urls.get(gid)
    if not url:
        bad.append(gid); continue
    try:
        im = Image.open(io.BytesIO(get(url))).convert("RGB")
        im.thumbnail((160, 160))
        im.save(os.path.join(ROOT, "covers", gid + ".jpg"), "JPEG", quality=80, optimize=True)
        ok += 1
        print("  ok  ", games[gid]["name"])
    except Exception as e:
        bad.append(gid)
        print("  ERRORE", games[gid]["name"], "-", e)
    time.sleep(0.3)
print(f"\n{ok} copertine aggiornate, {len(bad)} non riuscite.")
if bad:
    print("Non riuscite:", ", ".join(games[g]["name"] for g in bad), "(rilancia lo script, oppure dimmelo)")
else:
    print("Fatto! Ora: git add covers && git commit -m \"Copertine corrette\" && git push")
