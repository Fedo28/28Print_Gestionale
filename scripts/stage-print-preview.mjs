import { mkdtemp, mkdir, lstat, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const exact = new Set(["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.mjs", "middleware.ts", "prisma.config.ts", "catalogo_servizi_template.xlsx", "logo.png"]);
const source = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const selected = [...new Set(source)].filter(name => exact.has(name) ||
  (/^(app|components|lib|prisma|public)\//.test(name) && !name.startsWith("public/uploads/")) ||
  name.startsWith("bridge/src/") || ["scripts/validate-production-env.ts", "scripts/build-print-preview.mjs", "scripts/prepare-pdf-viewer.mjs"].includes(name));
if (selected.some(name => /(^|\/)(\.env[^/]*|\.local[^/]*|\.git|node_modules)(\/|$)/.test(name) || /\.(dpapi|secret|sqlite|log)$/.test(name))) {
  throw Error("File locale riservato rilevato: staging annullato.");
}
const stage = await mkdtemp(path.join(os.tmpdir(), "28print-v1-preview-"));
for (const name of selected) {
  const sourcePath = path.join(root, name);
  if (!(await lstat(sourcePath)).isFile()) throw Error(`Sorgente non regolare: ${name}`);
  const destination = path.join(stage, name);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(sourcePath, destination);
}
await mkdir(path.join(stage, ".vercel"));
await writeFile(path.join(stage, ".vercel/project.json"), JSON.stringify({ projectId: "prj_kVnGFsm07tPWagLGTEPcecXwqSrH", orgId: "team_vDG0VWSeOPY17yabsGDfPke7", projectName: "28-print-gestionalev1" }));
await writeFile(path.join(stage, "vercel.json"), JSON.stringify({ buildCommand: "node scripts/build-print-preview.mjs", regions: ["fra1"] }, null, 2));
await writeFile(path.join(stage, ".vercelignore"), ".vercel\nnode_modules\n.next\n.env*\n");
console.log(JSON.stringify({ stage, project: "28-print-gestionalev1", files: selected.length, credentialsIncluded: false, productionConfigUnchanged: true }, null, 2));
