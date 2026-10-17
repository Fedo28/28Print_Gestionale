import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (name: string) => readFile(new URL(`../${name}`, import.meta.url), "utf8");
test("installer e pannello confrontano il SID risolto anche per nomi utente abbreviati", async () => {
  for (const file of ["windows/Install-Startup.ps1", "windows/Bridge-Control.ps1"]) {
    const script = await read(file);
    assert.match(script, /NTAccount\]::new\(\$taskUser\)\)\.Translate\(\[System.Security.Principal.SecurityIdentifier\]\)/);
    assert.match(script, /\$taskSid.Value -ne \$identity.User.Value/);
    assert.doesNotMatch(script, /Principal.UserId -notin/);
  }
});
// Contratti statici del pacchetto: non sostituiscono l'esecuzione WinForms/Task Scheduler su Windows.
test("installer usa avvio nascosto al login senza password e non forza un processo attivo", async () => {
  const script = await read("windows/Install-Startup.ps1");
  assert.match(script, /-WindowStyle Hidden/);
  assert.match(script, /-AtLogOn -User/);
  assert.match(script, /-LogonType Interactive -RunLevel Limited/);
  assert.match(script, /-MultipleInstances IgnoreNew/);
  assert.match(script, /State -eq 'Running'/);
  assert.match(script, /CreateShortcut/);
  assert.doesNotMatch(script, /Stop-Process|Stop-ScheduledTask|-AtStartup|-RunLevel Highest/);
});
test("il pannello non legge credenziali, non apre server e usa arresto cooperativo", async () => {
  const panel = await read("windows/Bridge-Control.ps1");
  assert.match(panel, /stop-request\.json/);
  assert.match(panel, /instanceId = \$status.instanceId/);
  assert.match(panel, /Disable-ScheduledTask/);
  assert.doesNotMatch(panel, /credential\.dpapi|vercel-bypass\.dpapi|ConvertTo-SecureString|Stop-Process|Stop-ScheduledTask|HttpListener/);
});
