import { spawn } from "node:child_process";
import path from "node:path";
import { verifyPrintTestIsolation } from "./print-test-env.mjs";
const env = await verifyPrintTestIsolation();
const mode = process.argv[2] || "test";
let command, args;
if (mode === "test") { command = "vitest"; args = ["run", "tests/print-bridge.integration.test.ts"]; }
else if (mode === "dev") { command = "next"; args = ["dev", "--hostname", "127.0.0.1", "--port", "3015"]; env.NODE_ENV = "development"; }
else if (mode === "build") { command = "next"; args = ["build"]; env.NODE_ENV = "production"; }
else if (mode === "seed") { command = "tsx"; args = ["--tsconfig", "tsconfig.json", "scripts/seed-print-test.ts"]; }
else throw Error("Modalità non valida.");
const child = spawn(path.join(process.cwd(), "node_modules/.bin", command), args, { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
