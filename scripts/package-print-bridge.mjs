import { mkdtemp, mkdir, lstat, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const desktopPatch = process.argv.includes("--desktop-patch");
// Lista chiusa: mai archiviare l'intero repository, la configurazione reale o dati runtime.
const files = desktopPatch ? ["windows/Install-Startup.ps1", "windows/Bridge-Control.ps1"] : [
  "package.json", "package-lock.json", "tsconfig.json", "config.example.json",
  "README.md", "README-START-WINDOWS.txt", "AGGIORNAMENTO-DESKTOP.txt", "Configura-Desktop.cmd", "CHANGELOG-PHASE2.md", "VERCEL-STATUS.md",
  "src/protocol.ts", "src/config.ts", "src/pdf.ts", "src/client.ts", "src/ledger.ts", "src/worker.ts", "src/cli.ts", "src/runtime-status.ts",
  "windows/Set-BridgeSecret.ps1", "windows/Start-Bridge.ps1", "windows/Install-Startup.ps1", "windows/Bridge-Control.ps1",
  "test/worker.test.ts", "test/client.test.ts", "test/runtime-status.test.ts", "test/windows-package.test.ts", "test/cli-lifecycle.test.ts"
];
const stage = await mkdtemp(path.join(os.tmpdir(), "28print-package-"));
const outputDir = path.join(root, "output/bridge");
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, `28PRINT-Bridge-${desktopPatch ? "desktop-fix" : "test"}-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.zip`);
const manifest = [];
try {
  const entries = files.map(name => ({ source: path.join(root, "bridge", name), name }));
  if (!desktopPatch) entries.push({ source: path.join(root, "output/pdf/28print-fiery-test-a4.pdf"), name: "test-document/28print-fiery-test-a4.pdf" });
  for (const { source, name } of entries) {
    if (!(await lstat(source)).isFile()) throw new Error(`File assente o non regolare: ${name}`);
    const dest = path.join(stage, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(source, dest);
    // PowerShell 5.1 legge correttamente UTF-8 con BOM; i launcher cmd usano CRLF.
    if (/\.(ps1|cmd)$/.test(name)) {
      const content = (await readFile(dest, "utf8")).replace(/^\uFEFF/, "").replace(/\r?\n/g, "\r\n");
      await writeFile(dest, (name.endsWith(".ps1") ? "\uFEFF" : "") + content);
    }
    manifest.push(`${createHash("sha256").update(await readFile(dest)).digest("hex")}  ${name}`);
  }
  const manifestName = desktopPatch ? "SHA256SUMS-DESKTOP-FIX.txt" : "SHA256SUMS.txt";
  await writeFile(path.join(stage, manifestName), manifest.join("\n") + "\n");
  const archive = spawnSync("zip", ["-q", "-X", output, ...entries.map(entry => entry.name), manifestName], { cwd: stage, encoding: "utf8" });
  if (archive.error || archive.status !== 0) throw new Error(`Creazione ZIP fallita: ${archive.error?.message || archive.stderr}`);
  const verify = spawnSync("unzip", ["-t", output], { encoding: "utf8" });
  if (verify.status !== 0) throw new Error("Verifica ZIP fallita.");
  const sha256 = createHash("sha256").update(await readFile(output)).digest("hex");
  await writeFile(`${output}.sha256`, `${sha256}  ${path.basename(output)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ archive: output, files: entries.length + 1, sha256, containsCredentials: false }, null, 2));
} finally {
  // Solo directory temporanea creata da questo processo, mai dati di un Bridge installato.
  await rm(stage, { recursive: true, force: true });
}
