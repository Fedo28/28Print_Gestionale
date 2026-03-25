import { randomBytes } from "crypto";
import { spawn } from "child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envExamplePath = path.join(projectRoot, ".env.example");
const envPath = path.join(projectRoot, ".env");
const uploadsRoot = path.join(projectRoot, "public", "uploads", "orders");
const defaultDatabaseUrl = "postgresql://USER:PASSWORD@HOST:5432/fede_kart?schema=public";
const defaultAuthSecret = "change-me-in-production";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function getEnvValue(content: string, key: string) {
  const match = content.match(new RegExp(`^${escapeRegExp(key)}=(.*)$`, "m"));
  if (!match) {
    return null;
  }

  const rawValue = match[1].trim();
  if (
    (rawValue.startsWith("\"") && rawValue.endsWith("\"")) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function upsertEnvValue(content: string, key: string, value: string) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPlaceholderDatabaseUrl(databaseUrl: string | null) {
  if (!databaseUrl) {
    return true;
  }

  return databaseUrl.includes("USER:PASSWORD@HOST") || !databaseUrl.startsWith("postgresql://");
}

async function ensureEnvFile() {
  let created = false;

  if (!(await fileExists(envPath))) {
    await copyFile(envExamplePath, envPath);
    created = true;
  }

  let content = normalizeLineEndings(await readFile(envPath, "utf8"));
  const changes: string[] = [];

  let databaseUrl = getEnvValue(content, "DATABASE_URL");
  if (!databaseUrl) {
    databaseUrl = defaultDatabaseUrl;
    content = upsertEnvValue(content, "DATABASE_URL", databaseUrl);
    changes.push("Added DATABASE_URL to .env");
  }

  let authSecret = getEnvValue(content, "AUTH_SECRET");
  if (!authSecret || authSecret === defaultAuthSecret) {
    authSecret = randomBytes(32).toString("hex");
    content = upsertEnvValue(content, "AUTH_SECRET", authSecret);
    changes.push(created ? "Generated local AUTH_SECRET in new .env" : "Generated local AUTH_SECRET in existing .env");
  }

  if (created || changes.length > 0) {
    const normalized = content.endsWith("\n") ? content : `${content}\n`;
    await writeFile(envPath, normalized, "utf8");
  }

  return {
    created,
    changes,
    databaseUrl,
    localDemoData: getEnvValue(content, "LOCAL_DEMO_DATA") === "true"
  };
}

function getNpmRunner() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return {
      command: process.execPath,
      argsPrefix: [npmExecPath]
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    argsPrefix: []
  };
}

async function runCommand(label: string, command: string, args: string[]) {
  console.log(`\n> ${label}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function runNpmScript(script: string) {
  const runner = getNpmRunner();
  await runCommand(`npm run ${script}`, runner.command, [...runner.argsPrefix, "run", script]);
}

async function main() {
  console.log("Preparing local environment for Fede Kart...");

  const envState = await ensureEnvFile();
  await mkdir(uploadsRoot, { recursive: true });

  if (envState.created) {
    console.log("Created .env from .env.example");
  } else {
    console.log("Using existing .env");
  }

  if (envState.changes.length > 0) {
    for (const change of envState.changes) {
      console.log(`- ${change}`);
    }
  } else {
    console.log("- Existing .env already contained required local settings");
  }

  console.log(`- DATABASE_URL: ${envState.databaseUrl}`);
  console.log(`- Upload root: ${path.relative(projectRoot, uploadsRoot)}`);

  if (isPlaceholderDatabaseUrl(envState.databaseUrl)) {
    throw new Error(
      "DATABASE_URL non configurato per Postgres. Aggiorna .env con il database online o locale prima di eseguire il setup."
    );
  }

  await runNpmScript("db:generate");
  await runNpmScript("db:migrate:deploy");

  if (envState.localDemoData) {
    await runNpmScript("db:seed:local");
  } else {
    console.log("\n> demo seed skipped");
    console.log("- LOCAL_DEMO_DATA non attivo: nessun dato demo caricato.");
  }

  console.log("\nLocal setup completed.");
  console.log("Next steps:");
  console.log("- Start dev server: npm run dev");
  console.log("- Start production-like local server: npm run build && npm run start");
  console.log("- Open http://localhost:3000");
  if (envState.localDemoData) {
    console.log("- Seed login: admin@fede.local / admin123");
  } else {
    console.log("- Se vuoi i dati demo locali, imposta LOCAL_DEMO_DATA=\"true\" nel .env e rilancia npm run setup");
  }
}

main().catch((error) => {
  console.error("\nLocal setup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
