#!/usr/bin/env python3
"""Genera data/games.json, data/games.js (per file://), covers/*.jpg e giochi_numerati.md da giochi_import.json.

Uso: python3 tools/build_data.py   (richiede Pillow)
Il numero (n) di ogni gioco è la sua posizione 1-based nel file originale.
"""
import base64, io, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SIDE = 160

src = json.load(open(os.path.join(ROOT, "giochi_import.json"), encoding="utf-8"))
os.makedirs(os.path.join(ROOT, "covers"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)

games, lines = [], ["# Elenco numerato dei giochi\n"]
for i, g in enumerate(src["games"], 1):
    gid = str(g["bgg_id"])
    raw = base64.b64decode(g["image"].split(",", 1)[1])
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    im.save(os.path.join(ROOT, "covers", gid + ".jpg"), "JPEG", quality=80, optimize=True)
    games.append({"n": i, "id": gid, "name": g["name"], "cover": f"covers/{gid}.jpg"})
    lines.append(f"{i}. {g['name']}")

json.dump(games, open(os.path.join(ROOT, "data", "games.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(ROOT, "data", "games.js"), "w", encoding="utf-8") as f:
    f.write("window.GAMES=" + json.dumps(games, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(os.path.join(ROOT, "giochi_numerati.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(len(games), "giochi")
