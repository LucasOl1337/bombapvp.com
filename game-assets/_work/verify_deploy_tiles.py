from pathlib import Path
import re

js = next(Path("dist/_app").glob("arena-*.js"))
t = js.read_text(encoding="utf-8", errors="ignore")
print("bundle", js.name, "size", js.stat().st_size)
keys = [
    "floor-base-CMOacPV7",
    "floor-base-alt-CngzAfLT",
    "floor-lane-CRo3SCw8",
    "floor-spawn-Bj7HcVBG",
    "crate-CqTniTET",
    "tournament-clean",
    "sprite",
]
for k in keys:
    print(f"  {k}: {k in t}")

pngs = sorted(set(re.findall(r"/_app/(?:floor|crate|wall)[^\"'\\s]*\\.png", t)))
print("tile png refs:", pngs)

print("\ndist files:")
for p in sorted(Path("dist/_app").glob("*")):
    n = p.name
    if n.startswith(("floor-", "crate-", "wall-")) and n.endswith(".png"):
        print(f"  {n} {p.stat().st_size}")
