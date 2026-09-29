#!/usr/bin/env python3
"""Riscarica da BGG le copertine dei giochi il cui bgg_id è stato corretto (data/id_fix*.json).

Uso: python3 tools/fetch_covers.py   (richiede Pillow)
Sovrascrive covers/<id>.jpg per gli id corretti; le altre copertine restano quelle del file originale.
"""
import io, json, os, time, urllib.request
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fix = {}
for name in ("id_fix.json", "id_fix_manual.json"):
    p = os.path.join(ROOT, "data", name)
    if os.path.exists(p):
        fix.update(json.load(open(p, encoding="utf-8")))

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "board-game-imperialism"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

ids = list(fix.items())
done = 0
for i in range(0, len(ids), 20):
    chunk = ids[i:i + 20]
    xml = get("https://boardgamegeek.com/xmlapi2/thing?id=" + ",".join(b for _, b in chunk))
    thumbs = {it.get("id"): (it.findtext("thumbnail") or "").strip() for it in ET.fromstring(xml).findall("item")}
    for gid, bid in chunk:
        url = thumbs.get(bid)
        if not url:
            print("nessuna copertina per", gid, bid)
            continue
        try:
            im = Image.open(io.BytesIO(get(url))).convert("RGB")
            im.thumbnail((160, 160))
            im.save(os.path.join(ROOT, "covers", gid + ".jpg"), "JPEG", quality=80, optimize=True)
            done += 1
        except Exception as e:
            print("errore", gid, bid, e)
        time.sleep(0.3)
print(done, "copertine aggiornate")
