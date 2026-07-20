from pathlib import Path
import re

print("--- dist png ~2-4kb ---")
for p in sorted(Path("dist/_app").glob("*.png"), key=lambda x: x.stat().st_size):
    s = p.stat().st_size
    if 2000 <= s <= 4000:
        print(s, p.name)

print("source bomb", Path("game-assets/gameplay/bomb/sprites/bomb.png").stat().st_size)

t = Path("dist/_app/arena-z-PQjcyy.js").read_text(encoding="utf-8", errors="ignore")
print("sprites hits:", re.findall(r"sprites.{0,40}", t)[:10])
print("bomb.png hits:", re.findall(r"[^\s\"']*bomb[^\s\"']*\.png", t)[:20])
print("has bomb-Z or bomb-", "bomb-" in t)
# check if resolveGameAsset catalog keys exist as string
for key in ["gameplay.bomb.sprite", "gameplay.bomb.flame", "gameplay.bomb.flame.anim-sheet"]:
    print(key, "in bundle:", key in t)
