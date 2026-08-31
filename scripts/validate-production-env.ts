import fs from "fs";
import path from "path";

const requiredEnvNames = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "WEB_PUSH_VAPID_PUBLIC_KEY",
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "WEB_PUSH_VAPID_SUBJECT",
  "ADMIN_NAME",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "SHOP_BETA_LOCKED"
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

function isBooleanEnv(value: string) {
  return ["0", "1", "false", "true", "no", "yes", "off", "on"].includes(value.trim().toLowerCase());
}

function isTruthyEnv(value?: string) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
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

  if (name === "WEB_PUSH_VAPID_PUBLIC_KEY" || name === "WEB_PUSH_VAPID_PRIVATE_KEY") {
    return value.length < 40 || /change-me|placeholder/i.test(value);
  }

  if (name === "WEB_PUSH_VAPID_SUBJECT") {
    return !/^(mailto:|https?:\/\/)/i.test(value) && !value.includes("@");
  }

  if (name === "SHOP_BETA_LOCKED") {
    return !isBooleanEnv(value);
  }

  return false;
}

function main() {
  loadLocalEnvFallbacks();

  const missing = requiredEnvNames.filter((name) => isMissing(process.env[name]));
  const betaCodeMissing = isTruthyEnv(process.env.SHOP_BETA_LOCKED) && isMissing(process.env.SHOP_BETA_ACCESS_CODE);
  const placeholders = requiredEnvNames
    .filter((name) => !missing.includes(name))
    .filter((name) => isPlaceholder(name, process.env[name]!.trim()));
  const invalidBetaCode =
    isTruthyEnv(process.env.SHOP_BETA_LOCKED) &&
    !betaCodeMissing &&
    String(process.env.SHOP_BETA_ACCESS_CODE || "").trim().length < 6;

  if (missing.length === 0 && !betaCodeMissing && placeholders.length === 0 && !invalidBetaCode) {
    console.log("Deploy env validation passed.");
    return;
  }

  console.error("Deploy env validation failed.");

  if (missing.length > 0) {
    console.error("Missing variables:");
    missing.forEach((name) => console.error(`- ${name}`));
  }

  if (betaCodeMissing) {
    console.error("Missing variables:");
    console.error("- SHOP_BETA_ACCESS_CODE");
  }

  if (placeholders.length > 0) {
    console.error("Variables still using invalid placeholder values:");
    placeholders.forEach((name) => console.error(`- ${name}`));
  }

  if (invalidBetaCode) {
    console.error("Variables still using invalid placeholder values:");
    console.error("- SHOP_BETA_ACCESS_CODE");
  }

  console.error("Update the Vercel project environment variables before deploying.");
  process.exit(1);
}

main();
