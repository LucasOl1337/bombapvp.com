from pathlib import Path
import re

t = Path("dist/_app/arena-BuLEbmQz.js").read_text(encoding="utf-8", errors="ignore")
for label, pat in [
    ("wall", r"/_app/[^\"']*wall[^\"']*"),
    ("floor-base", r"/_app/[^\"']*floor-base[^\"']*"),
    ("floor-lane", r"/_app/[^\"']*floor-lane[^\"']*"),
    ("floor-spawn", r"/_app/[^\"']*floor-spawn[^\"']*"),
    ("crate", r"/_app/[^\"']*crate[^\"']*"),
]:
    hits = sorted(set(re.findall(pat, t)))
    print(label, hits)
