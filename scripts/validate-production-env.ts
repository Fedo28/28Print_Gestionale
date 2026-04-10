import fs from "fs";
import path from "path";

const requiredEnvNames = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "ADMIN_NAME",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD"
] as const;

function loadEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]?.trim()) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadLocalEnvFallbacks() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

function isMissing(value?: string) {
  return !value?.trim();
}

function isPlaceholder(name: (typeof requiredEnvNames)[number], value: string) {
  if (name === "DATABASE_URL") {
    const isPlaceholderValue = value.includes("USER:PASSWORD@HOST");
    const hasValidProtocol = value.startsWith("postgres://") || value.startsWith("postgresql://");
    return isPlaceholderValue || !hasValidProtocol;
  }

  if (name === "AUTH_SECRET") {
    return value === "change-me-in-production" || value.length < 32;
  }

  if (name === "ADMIN_PASSWORD") {
    return value === "change-me" || value.length < 8;
  }

  if (name === "ADMIN_EMAIL") {
    return !value.includes("@");
  }

  return false;
}

function main() {
  loadLocalEnvFallbacks();

  const missing = requiredEnvNames.filter((name) => isMissing(process.env[name]));
  const placeholders = requiredEnvNames
    .filter((name) => !missing.includes(name))
    .filter((name) => isPlaceholder(name, process.env[name]!.trim()));

  if (missing.length === 0 && placeholders.length === 0) {
    console.log("Deploy env validation passed.");
    return;
  }

  console.error("Deploy env validation failed.");

  if (missing.length > 0) {
    console.error("Missing variables:");
    missing.forEach((name) => console.error(`- ${name}`));
  }

  if (placeholders.length > 0) {
    console.error("Variables still using invalid placeholder values:");
    placeholders.forEach((name) => console.error(`- ${name}`));
  }

  console.error("Update the Vercel project environment variables before deploying.");
  process.exit(1);
}

main();
