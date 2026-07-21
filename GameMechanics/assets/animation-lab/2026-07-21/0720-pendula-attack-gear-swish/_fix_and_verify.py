"""Rebuild atlases for exact frame match; verify GIF order; clean temp artifacts."""
from PIL import Image
import numpy as np
from pathlib import Path

root = Path(__file__).resolve().parent


def rebuild_atlas(frames_dir: Path, cell: int, out_path: Path) -> None:
    sheet = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
    for i in range(16):
        r, c = divmod(i, 4)
        fr = Image.open(frames_dir / f"frame-{i:02d}.png").convert("RGBA")
        assert fr.size == (cell, cell), (fr.size, cell)
        sheet.paste(fr, (c * cell, r * cell), fr)
    sheet.save(out_path)
    print(f"wrote {out_path.name} {sheet.size}")


def exact_match(sheet_path: Path, frames_dir: Path, cell: int) -> bool:
    sheet = np.array(Image.open(sheet_path).convert("RGBA"))
    ok = True
    for i in range(16):
        r, c = divmod(i, 4)
        cell_img = sheet[r * cell : (r + 1) * cell, c * cell : (c + 1) * cell]
        frame = np.array(Image.open(frames_dir / f"frame-{i:02d}.png").convert("RGBA"))
        if not np.array_equal(cell_img, frame):
            print(f"  MISMATCH frame-{i:02d}")
            ok = False
    print(f"{sheet_path.name} exact match: {ok}")
    return ok


def verify_gif_order() -> None:
    gif = Image.open(root / "preview" / "preview.gif")
    print(f"GIF n_frames={gif.n_frames} size={gif.size}")
    scores = []
    for i in range(gif.n_frames):
        gif.seek(i)
        g = np.array(gif.convert("RGBA").resize((256, 256)))
        best_j, best_mse = None, 1e18
        for j in range(16):
            f = np.array(Image.open(root / "frames-256" / f"frame-{j:02d}.png").convert("RGBA"))
            # compare only where either has alpha
            mse = ((g.astype(float) - f.astype(float)) ** 2).mean()
            if mse < best_mse:
                best_mse, best_j = mse, j
        scores.append((i, best_j, best_mse))
        print(f"  gif[{i}] ~ frame-{best_j:02d} mse={best_mse:.1f}")
    order = [s[1] for s in scores]
    sequential = order == list(range(16))
    print(f"GIF order sequential 0..15: {sequential} order={order}")


rebuild_atlas(root / "frames-512", 512, root / "spritesheet-512-4x4.png")
rebuild_atlas(root / "frames-256", 256, root / "spritesheet-256-4x4.png")
exact_match(root / "spritesheet-512-4x4.png", root / "frames-512", 512)
exact_match(root / "spritesheet-256-4x4.png", root / "frames-256", 256)
verify_gif_order()
