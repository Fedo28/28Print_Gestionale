#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const mode = process.argv[2] || "listen";
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error("STRIPE_SECRET_KEY non configurata in .env.");
  process.exit(1);
}

if (!secretKey.startsWith("sk_test_")) {
  console.error("Questo listener locale accetta solo chiavi Stripe test sk_test_...");
  process.exit(1);
}

if (mode !== "listen" && mode !== "print-secret") {
  console.error("Uso: node --env-file=.env scripts/stripe-listen.js [listen|print-secret]");
  process.exit(1);
}

const stripeBin = path.join(
  __dirname,
  "..",
  "node_modules",
  "@stripe",
  "cli-darwin-arm64",
  "bin",
  "stripe"
);

const forwardTo =
  process.env.STRIPE_CLI_FORWARD_TO?.trim() ||
  "localhost:3000/api/shop/payments/stripe/webhook";

const args = ["listen", "--forward-to", forwardTo];

if (mode === "print-secret") {
  args.push("--print-secret");
}

const child = spawn(stripeBin, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    STRIPE_API_KEY: secretKey
  }
});

child.on("error", (error) => {
  console.error(`Impossibile avviare Stripe CLI: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
