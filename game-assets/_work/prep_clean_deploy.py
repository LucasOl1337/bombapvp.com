import shutil
import subprocess
from pathlib import Path

backup = Path("game-assets/_work/wip-backup-deploy")
backup.mkdir(parents=True, exist_ok=True)

wip = [
    ".gitignore",
    "docs/gameplay.md",
    "src/original-game/Engine/bot-bomb.ts",
    "src/original-game/Engine/bot-pingo.ts",
    "src/original-game/Engine/bot-registry.ts",
    "src/original-game/Engine/bot-v3.ts",
    "src/original-game/Engine/danger-map.ts",
    "src/original-game/Gameplay/flame-contact.ts",
    "src/original-game/main.ts",
    "worker/index.js",
    "wrangler.jsonc",
    "game-assets/arenas/themes/tournament-clean/MANIFEST.md",
    "game-assets/arenas/themes/tournament-clean/floor-lane.png",
    "game-assets/arenas/themes/tournament-clean/wall.png",
    "tarefas/arena-visual-hud-goal-backlog.md",
    "tests/bot-bomb-expired-flame.test.mjs",
    "tests/bot-v3-match.test.mjs",
    "tests/danger-map-parity.test.ts",
    "tests/flame-contact.test.ts",
    "tests/lingering-flame-lethality.test.mjs",
    "tests/local-bot-registry.test.mjs",
    "tests/player-body-engine-smoke.test.mjs",
]

untracked = [
    "src/original-game/NetCode/continuous-online-client.ts",
    "tests/continuous-online-client.test.ts",
    "tests/engine-seat-lane.test.mjs",
    "tests/online-worker.test.mjs",
]

for rel in wip:
    p = Path(rel)
    if not p.exists():
        print("missing", rel)
        continue
    dest = backup / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    raw = subprocess.check_output(["git", "show", f"HEAD:{rel}"])
    p.write_bytes(raw)
    print("restored", rel)

for rel in untracked:
    p = Path(rel)
    if p.exists():
        dest = backup / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            dest.unlink()
        shutil.move(str(p), str(dest))
        print("moved aside", rel)

print("DONE")
