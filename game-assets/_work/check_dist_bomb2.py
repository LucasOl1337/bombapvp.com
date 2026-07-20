from pathlib import Path
import re

t = Path("dist/_app/arena-z-PQjcyy.js").read_text(encoding="utf-8", errors="ignore")

# Find catalog object entries around bomb.sprite
idx = t.find("gameplay.bomb.sprite")
print("idx", idx)
print(t[idx - 80 : idx + 120])
print("---")
# Find all data:image or tiny asset refs near bomb
for m in re.finditer(r"gameplay\.bomb\.[a-zA-Z0-9_.-]+", t):
    start = max(0, m.start() - 20)
    end = min(len(t), m.end() + 100)
    snippet = t[start:end]
    print(m.group(), "=>", snippet[:160].replace("\n", " "))
