from pathlib import Path
import re

t = Path("dist/_app/arena-BuLEbmQz.js").read_text(encoding="utf-8", errors="ignore")
# find catalog freeze object and nearby vars for tournament wall
idx = t.find('"arena.theme.tournament-clean.wall"')
print("catalog key at", idx)
print(t[idx : idx + 80])
# reverse search for object that maps keys - look for pattern :VAR around freeze
# find freeze with tournament-clean.wall
m = re.search(r'\{[^{}]*"arena\.theme\.tournament-clean\.wall":([A-Za-z0-9_$]+)', t)
if m:
    var = m.group(1)
    print("var", var)
    # find var definition
    dm = re.search(rf'(?:const |,|;){re.escape(var)}=("[^"]*"|\'[^\']*\'|`[^`]*`)', t)
    if not dm:
        dm = re.search(rf'{re.escape(var)}=("[^"]{{0,200}}")', t)
    print("def", dm.group(0)[:200] if dm else "NOT FOUND")
    # also try data:image
    dm2 = re.search(rf'{re.escape(var)}=(data:image[^,]*)', t)
    if dm2:
        print("dataurl prefix", dm2.group(1)[:80])
else:
    print("no match for catalog pattern")
    # broader
    for m in re.finditer(r'tournament-clean\.wall[^,]{0,40}', t):
        print(m.group())
