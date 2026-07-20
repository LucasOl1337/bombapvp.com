import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { spawnSync } from "node:child_process";

const auditDir = mkdtempSync(join(tmpdir(), "bombpvp-online-worker-"));
const metafilePath = join(auditDir, "worker-metafile.json");
const wranglerCli = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");

try {
  const result = spawnSync(process.execPath, [
    wranglerCli,
    "deploy",
    "--dry-run",
    "--outdir",
    auditDir,
    "--metafile",
    metafilePath,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }

  const metadata = JSON.parse(readFileSync(metafilePath, "utf8"));
  const inputs = Object.keys(metadata.inputs ?? {}).map((entry) => normalize(entry).replaceAll("\\", "/"));
  const forbidden = inputs.filter((entry) => (
    /\.(?:png|jpe?g|webp|gif|svg|ogg|mp3|wav|m4a)$/iu.test(entry)
    || /(?:^|\/)sound-manager\.ts$/u.test(entry)
    || /(?:^|\/)visual-runtime\.ts$/u.test(entry)
    || /(?:^|\/)definition\.ts$/u.test(entry)
    || /(?:^|\/)assets-catalog\.ts$/u.test(entry)
    || /(?:^|\/)arena-theme-assets\.ts$/u.test(entry)
    || /(?:^|\/)game-assets\/catalog\.ts$/u.test(entry)
  ));
  if (forbidden.length > 0) {
    throw new Error(`Worker imported presentation/media inputs:\n${forbidden.join("\n")}`);
  }

  const required = [
    "worker/index.js",
    "Champions/membership.ts",
    "Champions/headless-visual-runtime.ts",
    "src/online/runtime/authoritative-match.ts",
  ];
  const missing = required.filter((suffix) => !inputs.some((entry) => entry.endsWith(suffix)));
  if (missing.length > 0) {
    throw new Error(`Worker is missing required authoritative inputs:\n${missing.join("\n")}`);
  }

  const workerPath = join(auditDir, "index.js");
  const workerBytes = statSync(workerPath).size;
  const maxWorkerBytes = 600 * 1024;
  if (workerBytes > maxWorkerBytes) {
    throw new Error(`Worker bundle ${workerBytes}B exceeds ${maxWorkerBytes}B budget`);
  }

  process.stdout.write(
    `Online Worker bundle boundary OK: ${inputs.length} inputs, ${workerBytes} bytes, no media/presentation catalogs.\n`,
  );
} finally {
  rmSync(auditDir, { recursive: true, force: true });
}
