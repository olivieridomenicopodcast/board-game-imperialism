#!/usr/bin/env python3
"""Assegna tipo e stat a ogni gioco a partire da data/bgg.json.

Uso: python3 tools/build_stats.py
Legge:   data/bgg.json, data/games.json, data/type_overrides.json (correzioni a mano: {"numero": "Tipo"})
Scrive:  data/stats.js (window.STATS, indicizzato per id come games.json)
"""
import collections, json, math, os, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
games = json.load(open(os.path.join(ROOT, "data", "games.json"), encoding="utf-8"))
bgg = json.load(open(os.path.join(ROOT, "data", "bgg.json"), encoding="utf-8"))
ovr_path = os.path.join(ROOT, "data", "type_overrides.json")
overrides = json.load(open(ovr_path, encoding="utf-8")) if os.path.exists(ovr_path) else {}

# In caso di parità vince il tipo più a sinistra (i più rari/specifici prima).
TYPES = ["Bambini", "Deduzione", "Cooperativo", "Party", "Astratto", "Guerra", "Economia",
         "Gestionale", "Ambientazione", "Fortuna", "Carte", "Strategia"]

# punteggi: categorie e meccaniche BGG che spingono verso un tipo
RULES = {
    "Bambini": {"cat": {"Children's Game": 10, "Educational": 2}},
    "Deduzione": {"cat": {"Deduction": 8, "Murder / Mystery": 5, "Spies / Secret Agents": 2, "Bluffing": 2},
                  "mech": {"Hidden Roles": 5, "Betting and Bluffing": 2, "Deduction": 4}},
    "Cooperativo": {"mech": {"Cooperative Game": 10}},
    "Party": {"cat": {"Party Game": 9, "Humor": 2, "Word Game": 3, "Real-time": 2},
              "mech": {"Team-Based Game": 2, "Communication Limits": 2, "Voting": 2}},
    "Astratto": {"cat": {"Abstract Strategy": 10, "Puzzle": 2},
                 "mech": {"Connections": 3, "Pattern Building": 2}},
    "Guerra": {"cat": {"Wargame": 8, "Fighting": 4, "Miniatures": 3, "Modern Warfare": 5, "World War II": 6,
                       "Napoleonic": 6, "American Civil War": 6, "Civil War": 6, "Ancient": 1},
               "mech": {"Campaign / Battle Card Driven": 5, "Area Movement": 1, "Area Majority / Influence": 2,
                        "Take That": 1}},
    "Economia": {"cat": {"Economic": 6, "Industry / Manufacturing": 3, "Trains": 2, "Transportation": 1},
                 "mech": {"Auction/Bidding": 6, "Stock Holding": 7, "Trading": 5, "Loans": 3, "Market": 4,
                          "Income": 2, "Contracts": 3, "Commodity Speculation": 6, "Ownership": 1}},
    "Gestionale": {"cat": {"Farming": 3, "City Building": 3, "Territory Building": 3, "Civilization": 3,
                           "Environmental": 2},
                   "mech": {"Worker Placement": 7, "Tableau Building": 5, "Action Points": 2,
                            "Network and Route Building": 1, "End Game Bonuses": 1}},
    "Ambientazione": {"cat": {"Fantasy": 3, "Adventure": 3, "Science Fiction": 3, "Horror": 4, "Mythology": 3,
                              "Exploration": 2, "Movies / TV / Radio theme": 4, "Video Game Theme": 5,
                              "Novel-based": 4, "Comic Book / Strip": 4, "Pirates": 3, "Zombies": 4,
                              "Space Exploration": 3},
                      "mech": {"Scenario / Mission / Campaign Game": 5, "Storytelling": 5, "Role Playing": 5,
                               "Narrative Choice / Paragraph": 6}},
    "Fortuna": {"cat": {"Dice": 2},
                "mech": {"Dice Rolling": 2, "Roll / Spin and Move": 6, "Push Your Luck": 5, "Betting and Bluffing": 1,
                         "Random Production": 4, "Chit-Pull System": 2}},
    "Carte": {"cat": {"Card Game": 5, "Collectible Components": 4},
              "mech": {"Hand Management": 2, "Trick-taking": 6, "Deck, Bag, and Pool Building": 4,
                       "Multi-Use Cards": 3, "Collectible Components": 6, "Open Drafting": 1}},
    "Strategia": {"cat": {},
                  "mech": {"Area Majority / Influence": 3, "Variable Player Powers": 2, "Action Queue": 3,
                           "Tile Placement": 2, "Network and Route Building": 2, "Set Collection": 1, "Area Movement": 1, "Simultaneous Action Selection": 2, "Movement Points": 2,
                           "Action Points": 1, "Hexagon Grid": 1, "Grid Movement": 1, "Modular Board": 1}},
}


def scores(b):
    s = {t: 0 for t in TYPES}
    for t, r in RULES.items():
        for c in b["categories"]:
            s[t] += r.get("cat", {}).get(c, 0)
        for m in b["mechanics"]:
            s[t] += r.get("mech", {}).get(m, 0)
    w = b["weight"] or 0
    if b["minAge"] and b["minAge"] <= 6:
        s["Bambini"] += 5
    if w >= 2.2:
        s["Strategia"] += 1
    if w >= 3.0:
        s["Gestionale"] += 1
        s["Strategia"] += 1
    if 0 < w <= 1.4:
        s["Party"] += 1
    s["Strategia"] += 1  # base: se nulla spicca è "Strategia"
    return s


def pick(s):
    best = max(s.values())
    return next(t for t in TYPES if s[t] == best)


assigned = {}
for g in games:
    assigned[g["id"]] = overrides.get(str(g["n"])) or pick(scores(bgg[g["id"]]))

# peso mancante: media del tipo assegnato (poi globale)
by_type = collections.defaultdict(list)
for g in games:
    w = bgg[g["id"]]["weight"]
    if w:
        by_type[assigned[g["id"]]].append(w)
gmed = statistics.median(w for l in by_type.values() for w in l)
rating_med = statistics.median(b["rating"] for b in bgg.values() if b["rating"])


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


stats = {}
for g in games:
    b, t = bgg[g["id"]], assigned[g["id"]]
    est = []
    w = b["weight"]
    if not w:
        w = statistics.mean(by_type[t]) if by_type[t] else gmed
        est.append("peso")
    r = b["rating"]
    if not r:
        r = rating_med - 0.5
        est.append("rating")
    p = b["playTime"] or 45
    if not b["playTime"]:
        est.append("durata")
    m = b["maxPlayers"] or 4
    stats[g["id"]] = {
        "t": t,
        "hp": round(90 + 10 * clamp(m, 2, 8)),
        "atk": round(clamp(50 + 15 * (w - 1), 50, 110)),
        "def": round(clamp(50 + (r - 5.0) / 3.5 * 55, 45, 115)),
        "spd": round(clamp(110 - 22 * math.log2(max(p, 10) / 15), 30, 110)),
        **({"est": est} if est else {}),
    }

with open(os.path.join(ROOT, "data", "stats.js"), "w", encoding="utf-8") as f:
    f.write("window.STATS=" + json.dumps(stats, ensure_ascii=False, separators=(",", ":")) + ";\n")

cnt = collections.Counter(s["t"] for s in stats.values())
print("distribuzione tipi:", ", ".join(f"{t} {cnt[t]}" for t in TYPES))
