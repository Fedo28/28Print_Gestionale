const requiredEnvNames = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "ADMIN_NAME",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD"
] as const;

function isMissing(value?: string) {
  return !value?.trim();
}

function isPlaceholder(name: (typeof requiredEnvNames)[number], value: string) {
  if (name === "DATABASE_URL") {
    return value.includes("USER:PASSWORD@HOST") || !value.startsWith("postgresql://");
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
