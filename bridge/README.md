# 28PRINT Bridge — prototipo Fase 2

Stato: il 16 ottobre l'operatore ha confermato il collaudo della versione 0.1 sul PC Windows: consegna di un PDF dalla Preview V1 a un solo lavoro in attesa su IPC650, riavvio senza duplicati e attività pianificata funzionante. La versione 0.2 aggiunge pannello desktop e avvio nascosto: codice verificato localmente, interfaccia Windows ancora da verificare dopo aggiornamento. Stato in [VERCEL-STATUS.md](VERCEL-STATUS.md).

Il prototipo gestisce PDF allegati a ordini interni, approvazione amministratore, coda PostgreSQL, recupero autenticato, registro SQLite e deposito nella Hot Folder IPC650 già configurata. Il pulsante di stampa delle schede tramite browser e gli stati commerciali degli ordini restano invariati.

## 1. Limiti e garanzie da conoscere

- Un solo profilo: `A4_BW_SIMPLEX_1_HOLD_V1`, A4, scala di grigi, solo fronte, **una copia**, azione **G100 attesa**. Il PDF non viene trasformato: colore, copie e fronte/retro vengono applicati dalla Hot Folder, che l'operatore deve verificare.
- Solo PDF non cifrati, massimo 20 MiB e 500 pagine; tutte le pagine devono avere MediaBox A4 verticale o orizzontale. Non è un preflight tipografico completo: non verifica font, sovrastampa, risoluzione o corrispondenza CropBox/MediaBox.
- L'amministratore apre il PDF, conferma il profilo e approva una specifica impronta SHA-256. Il contenuto viene ricontrollato al download e nel Bridge. Un allegato modificato o eliminato non viene sostituito automaticamente.
- `Consegnato alla Hot Folder` significa che il deposito sul filesystem è riuscito, **non** che Fiery l'abbia acquisito o che sia stato stampato. `Stampato` richiede una conferma manuale.
- Doppie approvazioni della stessa revisione convergono sullo stesso lavoro. Le prese in carico sono esclusive e durano 120 secondi, rinnovabili prima dell'invio.
- Prima del deposito il Bridge registra in SQLite l'intenzione di inviare e ottiene l'autorizzazione server. Una volta iniziato l'invio il server non riassegna automaticamente il lavoro.
- Un PDF completo viene preparato e sincronizzato su disco fuori dalla cartella sorvegliata; la pubblicazione usa un hard link locale sullo stesso volume, senza sovrascrittura. Nessun fallback a copie parziali o reinvii. La compatibilità di questa pubblicazione con **quella versione di Hot Folders** deve essere verificata sul PC.
- Se la ricevuta HTTPS si perde, viene ritentata solo la ricevuta. Un arresto fra deposito e registrazione dell'esito produce `Da verificare`, mai un nuovo deposito. Un lavoro in invio senza ricevuta viene segnalato dopo dieci minuti al successivo polling; a Bridge spento è disponibile anche la segnalazione manuale.
- Non è possibile garantire “exactly once” tra PostgreSQL, filesystem e Fiery, che non condividono una transazione. La scelta è fermarsi nei casi ambigui. Non cancellare il registro SQLite per sbloccare una stampa; non ripristinare vecchi backup mentre il Bridge è attivo.
- Nessun Banco Online, JPEG, A3, JDF, copie variabili o smistamento automatico. Aggiungere chiavi/destinazioni non richiede cambiare i percorsi nel codice, ma la configurazione completa via interfaccia è Fase 3.

## 2. Ambiente locale già predisposto sul Mac

È stato creato un cluster PostgreSQL dedicato su `127.0.0.1:54339`, database `fede_print_bridge_test`, senza copiare dati reali. I controlli verificano anche il percorso fisico del cluster. Gli upload sono locali; Blob, email, Stripe e push sono disabilitati nei processi di prova. Le 29 migrazioni, compresa quella per le sorgenti di stampa, sono state applicate qui; la migrazione iniziale del Bridge era già stata applicata anche al database V1 Preview.

Nella radice del repository:

```sh
npm run print:test:setup
npm run print:test
npm run print:test:seed
npm run print:test:dev
```

Aprire `http://127.0.0.1:3015/orders/print-test-order`. L'utente sintetico è `bridge-test`; la password è nel file locale ignorato `.local-print-test/access.json`. Non copiarla in chat. Il seed non autorizza lavori. Il file `.local-print-test/environment.json` contiene credenziali esclusivamente locali e il percorso del cluster. Il setup riutilizza il cluster registrato; in questa sessione è sotto `/private/tmp/28print-runtime.nM7OgF/pgdata` e non va considerato un archivio permanente. Se il sistema elimina questa directory, interrompere e ricreare consapevolmente il solo ambiente di prova.

Per la compilazione isolata: `npm run print:test:build`. Per i test indipendenti del Bridge:

```sh
cd bridge
npm ci
npm run typecheck
npm test
```

L'eccezione HTTP vale soltanto per loopback nel test locale. Non esporre questo server in LAN, non aprire porte sul router e non usarlo come endpoint Windows remoto.

## 3. Preparare il gestionale HTTPS di prova — prerequisito ancora da completare

Questa parte richiede l'amministratore del deploy. **Non usare il progetto/credenziali di produzione e non lanciare il normale deploy di produzione.** Il repository ha già un comando `vercel-build` che esegue migrazioni e bootstrap: non collegare il branch a un ambiente che eredita il database reale.

1. Predisporre un progetto/ambiente di test con deploy **Preview**, URL HTTPS stabile e certificato valido. Verificare database, utente DB e store Blob distinti da quelli reali, senza dati cliente. Il prototipo è intenzionalmente disabilitato quando `VERCEL_ENV=production`, anche in un progetto separato.
2. Configurare soltanto nel server/gestore segreti: `DATABASE_URL` del DB di test, un nuovo `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` dello store di test, un amministratore di test (`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NICKNAME`). Non impostare prefissi `NEXT_PUBLIC_` per questi valori.
3. Impostare `PRINT_BRIDGE_ENABLED=true`, `PRINT_BRIDGE_ENVIRONMENT=test`, `PRINT_BRIDGE_BLOB_HOSTS=<hostname-esatto-dello-store-di-test>.public.blob.vercel-storage.com`. Quest'ultima variabile contiene solo hostname, separati da virgola, senza URL, percorsi o wildcard. Non impostare `PRINT_BRIDGE_LOCAL_TEST` nel cloud. Lasciare disabilitate email, pagamenti e push; non usare segreti reali come segnaposto.
4. Verificare esplicitamente la destinazione prima di applicare migrazioni/bootstrap e pubblicare la Preview. Le migrazioni nuove aggiungono solo enum e tabelle; non alterano gli ordini preesistenti. Non è stato eseguito alcun deploy da questa task.
5. Usare solo documenti sintetici: lo storage allegati esistente è **Blob pubblico**, non storage privato. Il Bridge scarica attraverso API autenticate, ma questo non rende privato l'URL originale dell'allegato. La riservatezza dei documenti reali e lo storage Banco Online richiedono un intervento successivo.
6. V1 ha Vercel Authentication attiva. Il Bridge supporta una seconda credenziale dedicata, `PRINT_BRIDGE_VERCEL_BYPASS`, inviata soltanto nell'header `x-vercel-protection-bypass`, mai in URL o cookie. Vale per il progetto V1, non per il gestionale operativo; non sostituisce il bearer del Bridge né l'approvazione amministratore. Non disattivare protezioni. Prima di proseguire verificare che una chiamata con il solo header Vercel e senza bearer riceva il `401` JSON dell'applicazione, non una pagina di login Vercel. Senza header Vercel il blocco della piattaforma è atteso.
7. Non mettere `DATABASE_URL`, Blob token o `AUTH_SECRET` sul PC Windows. Gli serve soltanto la sua credenziale dedicata.

## 4. Registrare il Bridge e ottenere la credenziale

Operazione amministrativa **solo sul DB di test verificato**, da una macchina fidata con il repository. Preparare localmente `.env.print-test` con le variabili server di prova; è ignorato da Git. Non incollarne il contenuto in chat. Assicurarsi che la shell non abbia `DATABASE_URL` esportato verso un altro ambiente: `--env-file` non sovrascrive variabili già esportate.

```sh
node --env-file=.env.print-test node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/provision-print-bridge.ts --key ipc650-test-a4-bn --token-file .local-print-test/ipc650-token.secret
```

Il comando crea Bridge e destinazione logica, salva nel DB solo l'hash della credenziale e scrive il segreto in un nuovo file locale protetto, senza stamparlo. Se il file esiste il comando si ferma. Il provisioning non crea né modifica le Hot Folders e non invia documenti.

Trasferire il segreto con un canale riservato al PC, senza browser del gestionale, chat, commit o file condivisi pubblicamente. Dopo l'importazione DPAPI conservare eventualmente una copia nel proprio gestore segreti, rimuovendo le copie temporanee.

La pagina `/settings/printing` mostra destinazioni, ultimo contatto, ultimi lavori e revoca. Si raggiunge anche da “Bridge e destinazioni” nella pagina Fiery dell'ordine. La creazione/rotazione dei token resta una procedura amministrativa, non un form browser.

Per ruotare una credenziale, arrestare prima il Bridge, prendere il suo ID dal provisioning e usare un **nuovo** file:

```sh
node --env-file=.env.print-test node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/provision-print-bridge.ts --rotate-bridge INSERIRE_ID_BRIDGE --token-file .local-print-test/ipc650-token-nuovo.secret
```

Questo comando invalida il token precedente e riabilita il Bridge. Ripetere l'importazione DPAPI su Windows; non cancellare SQLite. La revoca blocca richieste successive, non può ritirare un'autorizzazione di deposito già concessa: per fermare il processo arrestarlo anche sul PC.

## 5. Installazione manuale Windows

Eseguire con **lo stesso utente Windows che utilizza Hot Folders**, senza cambiare sistema operativo, driver o configurazione Fiery.

1. L'operatore ha confermato il percorso completo `C:\Users\UTENTE\Desktop\Automazione 650\28PRINT_TEST_A4_BN` e il volume C: NTFS. Il percorso è già nel modello JSON. Restano da verificare IPC650/G100, A4, scala di grigi, solo fronte, alimentazione autoselezione, **copie 1**, **G100 attesa**. Non cambiare la Hot Folder C7260.

2. Estrarre il **contenuto** del pacchetto `28PRINT-Bridge-test-*.zip` in `C:\28PRINT-Bridge` (non l'intero gestionale). In alternativa copiare i soli sorgenti di `bridge`. Non sovrascrivere un'installazione con registro o credenziali già presenti. Devono esserci `package.json`, `package-lock.json`, `src`, `windows`, `test`, `tsconfig.json` e `config.example.json`. Non copiare `node_modules` dal Mac, né `.env`, né `.local-print-test`. Per rigenerare lo ZIP sul Mac: `node scripts/package-print-bridge.mjs`; usa una lista chiusa di file e include il PDF sintetico, non i dati runtime.

3. Aprire PowerShell e installare/verificare:

```powershell
Set-Location 'C:\28PRINT-Bridge'
node --version
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
```

Richiesto Node 24.14 o successivo della serie 24; la versione 24.22 comunicata rientra nell'intervallo. Un eventuale avviso sperimentale su `node:sqlite` non indica da solo un fallimento; tutti i test devono passare.

4. Creare la configurazione e aprirla:

```powershell
Copy-Item -LiteralPath '.\config.example.json' -Destination '.\config.json'
notepad.exe '.\config.json'
```

Non ripetere la copia su una configurazione già compilata. Inserire l'origine HTTPS di prova in `baseUrl`, senza percorso o slash aggiuntivi. Sostituire `hotFolder` con il percorso esatto, usando `\\` nel JSON. Lasciare la chiave `ipc650-test-a4-bn` uguale a quella registrata sul server. `workDir` resta `C:\28PRINT-Bridge`; `staging` resta `C:\28PRINT-Bridge-Staging` **solo se la Hot Folder è sullo stesso volume C:**. Staging e lavoro non devono essere dentro una Hot Folder, né contenerne una. Niente cartelle di rete, OneDrive o volumi non NTFS per il primo collaudo.

Impostare `verifiedHoldOneCopy` a `true` **solo dopo il controllo del punto 1**. Il valore iniziale `false` blocca volutamente l'avvio. Non impostare `allowLoopbackHttp` sul PC del negozio.

5. Controllare volume e cartelle:

```powershell
Get-Volume -DriveLetter C | Select-Object DriveLetter, FileSystem
npm.cmd run check
```

Il controllo crea solo le directory del Bridge/staging e verifica i percorsi/permessi. **Non deposita file e non contatta il gestionale**; non certifica impostazioni Fiery, hard link o ricezione del lavoro. Se la Hot Folder è su un'altra unità, adattare staging e controllo volume.

6. Importare il segreto tramite richiesta nascosta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\windows\Set-BridgeSecret.ps1'
```

Incollarlo solo quando richiesto, non nella riga di comando. Verrà cifrato con DPAPI in `data\credential.dpapi` e limitato all'utente corrente. Non è trasferibile come file utilizzabile da un altro utente/PC: lì va reimportata la credenziale. Il processo Node la riceve in memoria tramite ambiente, mai tramite URL.

7. Per la Preview protetta V1 importare anche la chiave di automazione del **solo progetto di test**, con input nascosto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\windows\Set-BridgeSecret.ps1' -Kind VercelBypass
```

Viene conservata separatamente in `data\vercel-bypass.dpapi`, protetta dallo stesso utente Windows. `Start-Bridge.ps1` carica entrambe le credenziali in memoria e ripristina l'ambiente alla chiusura. Non inserire questa chiave nel JSON, nell'URL, nel repository o nel browser del gestionale. La chiave Vercel consente accesso ai deploy dell'intero progetto V1: proteggerla e revocarla quando il collaudo termina. L'autenticazione e le autorizzazioni dell'applicazione restano obbligatorie.

8. Non avviare ancora in automatico: seguire prima il collaudo sotto. Non è necessaria alcuna porta aperta sul router; le sole richieste operative partono dal PC verso il gestionale HTTPS.

## 6. Prima prova reale — eseguita dall'operatore

1. Aprire Hot Folders e Command WorkStation sul PC. Confermare la cartella IPC650 in **attesa** e la coda visibile. Non premere “Stampa”.
2. Nel gestionale **di prova**, creare un ordine interno sintetico e allegare `test-document/28print-fiery-test-a4.pdf` dallo ZIP (nel repository: `output/pdf/28print-fiery-test-a4.pdf`). Si può caricare dal Mac o da qualsiasi dispositivo: non occorre inserirlo manualmente sul disco del PC o nella Hot Folder. Non usare file clienti. Prima dell'approvazione non deve esserci alcun lavoro autorizzato in coda.
3. Sul PC avviare manualmente:

```powershell
Set-Location 'C:\28PRINT-Bridge'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\windows\Start-Bridge.ps1'
```

4. Dal Mac/smartphone aprire l'ordine di prova, “Invio documenti a Fiery”, poi “Verifica e approva”. Aprire il PDF, confermare profilo/destinazione e premere **Approva invio a Fiery**. Le pagine aggiornano gli stati ogni 15 secondi quando visibili.
5. Attendere `Approvato` → `In preparazione` → `In invio a Fiery` → `Consegnato alla Hot Folder`. Con polling a 15 secondi la ricevuta arriva normalmente al ciclo successivo. Controllare che in Fiery esista **un solo** `28PRINT-<ID-LAVORO>.pdf`, nella coda **in attesa**, con formato e copie corretti.
6. Non confermare `Stampato`: durante questo collaudo non è stata eseguita una stampa fisica. Annotare ID, stato gestionale, presenza unica in Fiery, profilo verificato e orario. Se il file è consegnato ma assente da Fiery, il deposito non basta a dichiarare il test riuscito: verificare Hot Folders e i suoi errori.
7. Riavviare il Bridge con lo stesso `data` e verificare che non compaia una seconda copia. Un doppio clic di approvazione della stessa revisione non deve creare un nuovo job. Per una seconda prova intenzionale usare **Verifica il PDF e autorizza un nuovo invio**, con motivazione: questo genera un nuovo ID.
8. Solo dopo questo esito positivo attivare l'avvio automatico. Non simulare spegnimenti improvvisi della macchina di produzione per provare i crash: questi casi sono già coperti dai test su cartelle simulate.

## 7. Avvio automatico e arresto

Versione 0.2: per aggiornare l'installazione esistente seguire `AGGIORNAMENTO-DESKTOP.txt`. `Configura-Desktop.cmd` registra l'attività nascosta al login e crea **28PRINT Bridge** sul desktop. Il pannello WinForms mostra stato dell'attività e ultimo ciclo riuscito, apre gestionale e log, avvia o mette in pausa il Bridge. Non apre porte, non legge le chiavi e non richiede nuove dipendenze Node.

**Pausa Bridge** disabilita l'attività e scrive una richiesta per la sola istanza corrente. Il processo la legge fra le operazioni, mai interrompendo intenzionalmente una pubblicazione: le ricevute persistenti residue ripartono al prossimo avvio. La richiesta vecchia non arresta l'istanza successiva. **Avvia Bridge** riabilita l'attività. Chiudere il pannello non arresta il motore. Il file diagnostico `data/runtime-status.json` non è il registro dei lavori e non certifica la disponibilità di Fiery. Per nuove installazioni resta obbligatorio il primo collaudo.

Dopo il collaudo, con il medesimo account Windows:

```powershell
Set-Location 'C:\28PRINT-Bridge'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\windows\Install-Startup.ps1'
Get-ScheduledTask -TaskName '28PRINT Bridge'
```

L'attività parte **al login dell'utente**, non prima del login e non come servizio di sistema. Non configura autologin. Deve essere attiva anche l'applicazione Hot Folders; verificarne l'avvio già esistente. Il PC deve rimanere acceso, con sessione disponibile e senza sospensione durante il lavoro. Non sono state cambiate le impostazioni energetiche.

Chiudere con `Ctrl+C` l'istanza manuale prima di avviare quella pianificata. Per avviare deliberatamente l'attività dopo il collaudo:

```powershell
Start-ScheduledTask -TaskName '28PRINT Bridge'
```

Per fermare e impedire riavvii automatici:

```powershell
Disable-ScheduledTask -TaskName '28PRINT Bridge'
Stop-ScheduledTask -TaskName '28PRINT Bridge'
```

Una terminazione durante l'invio può produrre `Da verificare`, per scelta di sicurezza. Verificare che nessuna istanza manuale resti attiva. Il blocco SQLite impedisce due istanze sullo stesso `workDir`; non configurare una seconda installazione con la stessa credenziale.

## 8. Errori, ripristino e conservazione

Log: `C:\28PRINT-Bridge\logs\bridge.log` (rotazione a 5 MiB, tre precedenti). Errori: `errors\<ID>.json`. Registro e ricevute: `data\ledger.sqlite` con eventuali file WAL/SHM; `instance.sqlite` controlla la singola istanza. `downloads` è predisposta, ma in questa fase il download limitato avviene in memoria e il PDF temporaneo viene scritto direttamente nello staging√.

```powershell
Get-Content 'C:\28PRINT-Bridge\logs\bridge.log' -Tail 30
```

Non condividere file SQLite, credenziali o configurazioni senza revisione. Il registro contiene identificativi e assegnazioni. Per un backup consistente arrestare prima il Bridge e copiare l'intera directory `data`, non solo il file `.sqlite`; proteggere backup e accesso al PC. Su errori di rete le comunicazioni riprendono con attesa crescente fino a 5 minuti.

Per `Da verificare`: **arrestare il Bridge**, cercare lo stesso ID in coda, archivio e log Fiery e confrontare il registro locale. Nel gestionale registrare la verifica e scegliere ricezione confermata o mancata ricezione solo se accertata. Se resta un dubbio non autorizzare un nuovo invio. Dopo mancata ricezione confermata, il nuovo invio richiede comunque una nuova approvazione e motivazione.

Il sistema non deduce la ricezione dall'assenza del file nella Hot Folder: Fiery può averlo già spostato. Non cancellare file dalla Hot Folder o dalle cartelle interne Fiery per “resettare” il Bridge. I residui di staging dopo un crash vanno rimossi solo dopo aver fermato il Bridge e riconciliato il relativo lavoro. Il prototipo non effettua pulizie automatiche del registro.

Per disattivare la funzione lato gestionale basta `PRINT_BRIDGE_ENABLED=false`, revocare la credenziale e arrestare il Bridge. Non eliminare le nuove tabelle né il registro per tornare alla stampa manuale già esistente.

## 9. Verifiche e consegna

Il riepilogo dei controlli e l'elenco completo dei file sono in [CHANGELOG-PHASE2.md](CHANGELOG-PHASE2.md). Restano necessari: deploy HTTPS isolato, provisioning e trasferimento riservato delle credenziali di test, verifica permessi/una copia/attesa, installazione Windows e collaudo assistito sopra. Percorso completo e NTFS sono stati confermati dall'operatore, non verificati direttamente da questo Mac. La compatibilità nativa Windows/DPAPI/Task Scheduler e la ricezione Fiery non sono state provate da questo Mac.

Per la Fase 3: configurazione stampanti e profili via UI, routing e override manuale, JPEG→PDF con gestione geometria/qualità, formati/supporti e copie variabili con verifica dei limiti Fiery, revisione storage Banco Online prima dei dati reali. Non sono inclusi in questa consegna.

Riferimenti tecnici: [TypeScript nativo Node 24](https://nodejs.org/download/release/v24.16.0/docs/api/typescript.html), [collegamenti filesystem NTFS](https://learn.microsoft.com/en-us/windows/win32/fileio/file-and-directory-linking), [protezione SecureString/DPAPI](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertto-securestring).
