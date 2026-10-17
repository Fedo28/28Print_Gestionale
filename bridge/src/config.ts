import { readFile, realpath, mkdir, access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { PROFILE } from "./protocol.ts";

export type Destination = { hotFolder: string; staging: string; profileKey: string; verifiedHoldOneCopy: boolean };
export type BridgeConfig = { baseUrl: string; workDir: string; pollSeconds: number; allowLoopbackHttp?: boolean; destinations: Record<string, Destination> };
export async function loadConfig(file: string): Promise<BridgeConfig> {
  const config = JSON.parse(await readFile(file, "utf8")) as BridgeConfig;
  const url = new URL(config.baseUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(config.allowLoopbackHttp === true && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) {
    throw new Error("baseUrl deve essere l'origine HTTPS del gestionale di test.");
  }
  if (!path.isAbsolute(config.workDir) || !Number.isInteger(config.pollSeconds) || config.pollSeconds < 5 || config.pollSeconds > 300 ||
    !config.destinations || Object.keys(config.destinations).length < 1 || Object.keys(config.destinations).length > 20) throw new Error("Configurazione Bridge non valida.");
  config.baseUrl = url.origin;
  for (const [key, destination] of Object.entries(config.destinations)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key) || destination.profileKey !== PROFILE || destination.verifiedHoldOneCopy !== true ||
      !path.isAbsolute(destination.hotFolder) || !path.isAbsolute(destination.staging) || destination.hotFolder.startsWith("\\\\")) {
      throw new Error("Verificare destinazione locale, profilo A4 e conferma di attesa/una copia.");
    }
  }
  return config;
}
export async function checkDirectories(config: BridgeConfig) {
  // Reject nested working directories before creating anything: Fiery may scan subdirectories.
  const hotFolders = await Promise.all(Object.values(config.destinations).map(d => realpath(d.hotFolder)));
  const working = [config.workDir, ...Object.values(config.destinations).map(d => d.staging)];
  const inside = (child: string, parent: string) => { const rel = path.relative(parent, child); return rel === "" || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel)); };
  for (const work of working) {
    // Resolve existing parents as well as final paths to detect symlinks before mkdir.
    let parent = path.resolve(work); const suffix: string[] = [];
    while (true) {
      try { parent = path.join(await realpath(parent), ...suffix.reverse()); break; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; suffix.push(path.basename(parent)); const next = path.dirname(parent); if (next === parent) throw error; parent = next; }
    }
    if (hotFolders.some(hot => inside(parent, hot) || inside(hot, parent))) throw new Error("Le directory Bridge/staging devono essere separate dalle Hot Folders, senza contenerle.");
  }
  for (const folder of [config.workDir, ...["data", "downloads", "errors", "logs"].map(name => path.join(config.workDir, name)), ...working.slice(1)]) await mkdir(folder, { recursive: true });
  for (const destination of Object.values(config.destinations)) {
    const hot = await stat(destination.hotFolder), staged = await stat(destination.staging);
    if (!hot.isDirectory() || !staged.isDirectory() || hot.dev !== staged.dev) throw new Error("Hot Folder e staging devono essere cartelle locali sullo stesso volume.");
    await access(destination.hotFolder, constants.W_OK);
  }
}
