# Consegna Fase 2 — 15 ottobre 2026

## Aggiornamento desktop 0.2 — 16 ottobre

L'operatore ha confermato la consegna reale su IPC650 in attesa, assenza di duplicati dopo riavvio del Bridge 0.1 e attività pianificata funzionante. Aggiunti per la 0.2:

- attività al login con finestra nascosta, collegamento desktop e pannello WinForms senza dipendenze aggiuntive;
- avvio/pausa dal pannello, con arresto cooperativo della sola istanza corrente e riabilitazione esplicita dopo pausa;
- diagnostica locale priva di credenziali, ultimo ciclo riuscito e log generico per errori del launcher;
- pagina stato gestionale con aggiornamento automatico e distinzione fra contatto recente e contatto non confermato (modifiche locali non ancora distribuite);
- pacchetto aggiornabile senza sostituire config.json, chiavi, node_modules o registro SQLite; script PowerShell distribuiti UTF-8 BOM/CRLF per Windows PowerShell 5.1.

Verifiche 0.2: 24 test Bridge superati (inclusi processi CLI reali con API simulate 200/503, pausa e riavvio); typecheck Bridge e gestionale superati; 9 test stato connessione e guardie Preview superati. I test del pacchetto PowerShell sono controlli statici: WinForms e il nuovo avvio nascosto devono ancora essere verificati sul PC Windows. Il motore di consegna, il protocollo e il registro antiduplificazione non sono stati modificati. Nessun deploy, nessuna migrazione remota, nessun nuovo invio di stampa durante questo aggiornamento.

## Riferimento storico Fase 2

Branch: `codex/28print-bridge-phase2`. Modifiche locali senza commit/push. Una Preview V1 è stata avviata; la migrazione iniziale del Bridge è stata applicata al DB isolato di V1. Nessuna migrazione in produzione, nessuna operazione sulle stampanti e nessuna modifica alle Hot Folders esistenti.

## Componenti riutilizzati e aggiunte

Riutilizzati Next.js/App Router, Prisma/PostgreSQL, autenticazione staff, ruolo ADMIN, ordini interni e relativi allegati, storage allegati già esistente. I controlli di approvazione rileggono ruolo e stato attivo dell'utente dal DB. Non sono cambiati catalogo, prezzi, pagamenti, Banco Online, stati commerciali o stampa browser delle schede.

Aggiunti quattro modelli indipendenti: `PrintBridge`, `PrintDestination`, `PrintJob`, `PrintJobEvent`. I riferimenti a ordine/allegato/approvatore sono storici: eliminare un ordine non deve cancellare la prova di un precedente invio. I documenti non autorizzati compaiono in UI come “In attesa di approvazione”; una riga di coda viene creata solo con approvazione esplicita.

Nuove pagine `/orders/[id]/fiery` e `/settings/printing`, pannello sintetico nell'ordine, API dedicate a claim/renew/begin/report e download. Credenziali Bridge distinte da quelle degli operatori, revocabili, con solo hash nel database. Percorsi fisici esclusivamente nel JSON locale Windows. Il profilo di stampa è fissato per questo collaudo, non la posizione delle cartelle.

Bridge indipendente Node 24/TypeScript con SQLite persistente, single-instance, gestione ricevute dopo riavvio, blocco degli esiti incerti, pubblicazione di PDF completi senza sovrascrittura, log rotanti e script PowerShell per DPAPI e avvio al login.

## Test eseguiti

| Controllo | Esito |
| --- | --- |
| `npm test` nella radice | 176 passati; 32 saltati perché richiedono ambienti dedicati |
| `npm run print:test` sul DB isolato | 11/11 passati dopo l'aggiunta del controllo sulle nuove sorgenti |
| `npm test` in `bridge` | 17/17 passati, inclusi 5 test aggiunti per Preview protette |
| `npm run typecheck` in `bridge` | Passato |
| `tsc --noEmit --incremental false` nella radice | Passato |
| `npm run print:test:build` | Compilazione Next, controllo tipi e generazione pagine completati |
| `npm run print:test:setup` ripetuto | Cluster corretto, 29 migrazioni, nessuna pendente |
| `npm run print:test:seed` | Solo utente, cliente, ordine, allegato e Bridge sintetici |
| HTTP sull'app Next effettiva | Ordine, approvazione e impostazioni: 200; API anonima: 401; bearer di test: 200 con coda vuota prima dell'approvazione |
| Segreti nell'HTML delle tre pagine | Token Bridge e AUTH_SECRET assenti |
| PDF di prova | Generato, rasterizzato e verificato visivamente: una pagina A4, nessun dato cliente |
| `git diff --check` | Passato |

La baseline precedente contava 176 test ordinari, 10 di integrazione Bridge e 17 del pacchetto Windows. La nuova base multi-sorgente ha portato i test d'integrazione Bridge a 11/11; la verifica TypeScript è passata. I test di integrazione preesistenti di altre funzionalità non sono stati indirizzati al nuovo database né alla copia dei dati reali.

Aggiornamento installazione: seconda credenziale DPAPI opzionale per Vercel Preview protette, header su tutte le operazioni senza URL/cookie/redirect, modello con percorso confermato dall'operatore, pacchetto ZIP a lista chiusa con manifest SHA-256, esclusione esplicita dei dati locali dal deploy. Creato lo storage dedicato V1 Preview; dettagli e limitazioni in `VERCEL-STATUS.md`. Il pacchetto non implica che Windows o il deploy remoto siano già collaudati.

I nuovi test includono: approvazioni concorrenti, assegnazione esclusiva, scadenza lease e worker obsoleti, revoca, cancellazione, verifica SHA, ricevute ripetute, risoluzione manuale, nuova autorizzazione, divieto di stato PRINTED dal Bridge, cartelle non sovrapposte, assenza di sovrascritture, perdita di rete dopo il deposito e **processo figlio interrotto realmente dopo la pubblicazione**, con successiva riapertura SQLite. Un test percorre HTTP autenticato → PostgreSQL → Bridge → cartella simulata → aggiornamento dello stato.

Durante i test è stato corretto un confronto tra parametri PostgreSQL `timestamptz` e colonne Prisma UTC senza fuso: con sessione Europe/Rome poteva anticipare la scadenza di un lease. I confronti raw SQL ora normalizzano esplicitamente in UTC. Corretto anche il caso in cui un errore di log poteva sovrascrivere una ricevuta locale già registrata.

Esecuzione su macOS con Node 24.14.1 e PostgreSQL locale dedicato. **Non verificati qui:** runtime Windows 10/Node 24.22, DPAPI e attività pianificata reali, filesystem NTFS, rete del negozio, Vercel Preview/Blob remoti e acquisizione Fiery. Le prove su cartella simulata non sostituiscono il collaudo fisico descritto nella guida.

## File modificati

- `.gitignore` — esclude credenziali e dati locali del prototipo.
- `package.json`, `package-lock.json` — PDF parser condiviso e comandi di prova isolata.
- `tsconfig.json` — supporto import TypeScript del pacchetto Bridge e compilazione separata del pacchetto.
- `prisma/schema.prisma` — nuovi modelli ed enum, nessuna modifica ai modelli commerciali.
- `app/orders/[id]/page.tsx` — import e inserimento del pannello, solo due righe aggiunte.

## File aggiunti

Gestionale:

- `prisma/migrations/20261015140000_add_print_bridge/migration.sql`
- `lib/print-runtime.ts`
- `lib/print-source.ts`
- `lib/print-jobs.ts`
- `app/api/print-bridge/route.ts`
- `app/api/print-bridge/jobs/[id]/file/route.ts`
- `app/orders/[id]/fiery/actions.ts`
- `app/orders/[id]/fiery/page.tsx`
- `app/settings/printing/page.tsx`
- `components/print-order-panel.tsx`
- `components/print-live-refresh.tsx`

Pacchetto Bridge:

- `bridge/package.json`
- `bridge/package-lock.json`
- `bridge/tsconfig.json`
- `bridge/config.example.json`
- `bridge/src/protocol.ts`
- `bridge/src/config.ts`
- `bridge/src/pdf.ts`
- `bridge/src/client.ts`
- `bridge/src/ledger.ts`
- `bridge/src/worker.ts`
- `bridge/src/cli.ts`
- `bridge/windows/Set-BridgeSecret.ps1`
- `bridge/windows/Start-Bridge.ps1`
- `bridge/windows/Install-Startup.ps1`

Prove e documentazione:

- `tests/print-bridge.integration.test.ts`
- `bridge/test/worker.test.ts`
- `scripts/setup-print-test.mjs`
- `scripts/print-test-env.mjs`
- `scripts/run-print-test.mjs`
- `scripts/seed-print-test.ts`
- `scripts/provision-print-bridge.ts`
- `scripts/create-print-test-pdf.py`
- `output/pdf/28print-fiery-test-a4.pdf`
- `bridge/README.md`
- `bridge/CHANGELOG-PHASE2.md`
- `bridge/test/client.test.ts`
- `bridge/README-START-WINDOWS.txt`
- `bridge/VERCEL-STATUS.md`
- `scripts/package-print-bridge.mjs`

Gli artefatti runtime ignorati (`.local-print-test`, upload sintetico locale, dipendenze installate, file di build e cluster temporaneo) non devono essere inclusi nel repository o copiati sul PC del negozio.

## Cosa serve per chiudere il collaudo in negozio

1. URL HTTPS Preview stabile con database, credenziali e Blob di test realmente separati; accesso macchina alle API senza interferenze della protezione del deploy.
2. Provisioning della credenziale dedicata, da trasferire privatamente, mai in chat.
3. Percorso completo verificato di `28PRINT_TEST_A4_BN`, stesso volume NTFS dello staging, account e permessi corretti; verifica esplicita **una copia / attesa**.
4. Installazione manuale e prova documentata: approvazione dal Mac, un solo PDF in attesa in Fiery IPC650, stato di consegna nel gestionale e nessun duplicato dopo riavvio del Bridge.

Fino ad allora la consegna è un **prototipo verificato localmente**, non un sistema di stampa già operativo. I passaggi numerati e i comandi Windows sono in [README.md](README.md).
