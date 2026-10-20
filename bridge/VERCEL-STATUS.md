# Stato ambiente remoto — aggiornamento 16 ottobre 2026

Verifica effettuata dalla sessione Vercel del titolare, senza esportare dati cliente o pubblicare segreti. Il nuovo storage e la chiave V1 sono stati autorizzati esplicitamente dall'utente durante la configurazione.

## Risorse e isolamento

| Risorsa | Gestionale operativo | Progetto V1 |
| --- | --- | --- |
| Progetto | `28-print-gestionale` | `28-print-gestionalev1` |
| Database configurato | Neon, host distinto | Prisma Postgres `prisma-postgres-citrine-bridge` |
| Blob esistente | Collegamento invariato, tutti gli ambienti | Rimasto solo Production e Development |
| Nuovo Blob | Nessun collegamento | `28print-bridge-test`, solo Preview, FRA1, pubblico per file sintetici |
| Deployment Protection | Non modificata | Vercel Authentication Standard Protection mantenuta |

Il nuovo store ha ID `store_p0VcIvg2nRIYJ0xn`; quello condiviso precedente è `store_sM7hoO3rnnQRHLw0`. La connessione Preview nuova crea `BLOB_READ_WRITE_TOKEN` come Secret, oltre a ID store e chiave pubblica webhook. Non sono stati cancellati o spostati file, ruotate credenziali esistenti o modificati i collegamenti del progetto operativo.

**Le connessioni nuove valgono per i prossimi deploy. I deploy già esistenti non sono stati aggiornati e possono conservare le vecchie variabili.** Non usare una vecchia Preview per il collaudo.

Il database V1 ha un endpoint distinto dalla produzione. Prima del deploy sono stati verificati con sole letture aggregate tre utenti, un cliente, cinque ordini e zero allegati. La migrazione iniziale `20261015140000_add_print_bridge` è stata applicata a V1 durante la prima compilazione Preview; quella compilazione è poi fallita per un asset mancante. Non è stato eseguito alcun bootstrap remoto. La successiva migrazione `20261015190000_print_job_source` è stata applicata solo al database locale isolato.

## Accesso macchina e pubblicazione da verificare

- Supporto `x-vercel-protection-bypass` aggiunto al Bridge, con seconda credenziale DPAPI e test automatici. Richiede HTTPS e rifiuta redirect; non invia segreti in URL/cookie e conserva il bearer applicativo.
- Il titolare ha creato la chiave di bypass V1 nella console Vercel. Il valore non è stato salvato nel repository.
- Il login alla CLI ufficiale Vercel è stato completato per il tentativo di deploy Preview.
- `.vercel/project.json` locale punta al progetto **operativo**: non eseguire un deploy dalla radice usando quel collegamento. Preparare una directory di deploy distinta e collegarla esplicitamente a V1; mai `--prod` per questo prototipo.
- I due progetti sono collegati allo stesso repository GitHub. Il comando `vercel-build` esegue migrazioni e bootstrap. Non effettuare push per il collaudo senza prima verificare quali deploy automatici e database verrebbero coinvolti.
- Il secondo deploy Preview V1, `LvNB9YErhRXGh9nuceeFCH8gy2C3`, è stato verificato nella console Vercel il 16 ottobre: **Ready**, completato il 15 ottobre alle 19:59 CEST. URL: `https://28-print-gestionalev1-o9c643zxj-fedo28s-projects.vercel.app`. Dal browser autenticato Vercel arriva alla schermata di accesso del gestionale. Restano da verificare login amministratore, registrazione Bridge, storage del PDF e chiamate macchina con le credenziali dedicate. Il risultato Ready non certifica ancora il collaudo applicativo o fisico. Nessun deploy di produzione è stato eseguito.

## Avanzamento collaudo del 16 ottobre

- Login amministratore alla Preview verificato dal browser; la pagina `/settings/printing` è accessibile.
- Sul PC Windows il titolare ha confermato installazione completata, 17 test superati e `npm.cmd run check` riuscito. Il controllo locale non contatta il gestionale e non deposita PDF.
- Dopo una nuova verifica in sola lettura del database V1 (zero Bridge, zero lavori), registrato il Bridge `e957d129-1976-4b5f-b7fe-51925dc6c47a`, nome `PC negozio - prova IPC650`, con destinazione `ipc650-test-a4-bn` e profilo `A4_BW_SIMPLEX_1_HOLD_V1`. Registrazione verificata con lettura successiva.
- La credenziale dedicata è stata generata in un file privato temporaneo fuori dal repository, senza mostrarne il valore. Restano da completare il trasferimento sicuro e l'importazione DPAPI sul PC Windows, insieme alla chiave di automazione Vercel V1.
- Aggiornamento successivo confermato dall'operatore: entrambe le credenziali importate con DPAPI, contatto remoto attivo; PDF sintetico caricato sull'ordine `1bd4d544-0740-4eda-87f5-8e335d43749b`, approvato manualmente e consegnato. Un solo lavoro in attesa su Fiery; dopo riavvio del Bridge nessun duplicato e contatto aggiornato. Attività pianificata avviata e confermata funzionante. Non si tratta di verifica della stampa fisica; il riavvio completo di Windows non è ancora stato verificato.
- Versione 0.2 installata sul PC: l'operatore ha mostrato pannello attivo, ultimo ciclo riuscito e attività Running, dopo correzione del confronto utente tramite SID. Migliorie della pagina stato solo locali, non pubblicate sulla Preview. Nessuna modifica al progetto operativo.
- Gestione stampanti/profili implementata e verificata localmente: configurazione amministrativa, selezione prima dell'approvazione, preferenze e blocchi server. Migrazioni multisorgente e `20261016160000_print_configuration` ancora solo locali. Per pubblicazione coordinata e cambio URL Preview del PC vedere `docs/PRINT-CONFIGURATION.md`.

## Pubblicazione stampanti e profili — 16 ottobre, 15:39 CEST

Dopo conferma esplicita del Bridge in pausa, pubblicata esclusivamente la Preview V1 `dpl_6zmCuKwQGvpjTtivhrsTD3KDGmwV`, stato Ready. Applicate le migrazioni `20261015190000_print_job_source` e `20261016160000_print_configuration`, senza bootstrap. Alias stabile nuovo: `https://28print-bridge-v1-preview.vercel.app`, associato al deployment `28-print-gestionalev1-dv3o6oxfq-fedo28s-projects.vercel.app`. Nessun dominio precedente modificato.

Verifiche remote: protezione Vercel presente, login disponibile, schermata impostazioni protetta da login, API Bridge rifiuta credenziale applicativa assente (401). Unico lavoro ancora DELIVERED, destinazione esistente invariata e collegata al profilo legacy e alla stampante IPC650. Credenziali esistenti conservate; nessun invio eseguito. Il PC deve ancora aggiornare il solo baseUrl, riaprire il pannello e riprendere il Bridge: attesa conferma del nuovo contatto. Le indicazioni precedenti sulle migrazioni ancora locali descrivono lo stato storico prima di questa pubblicazione.

## Seconda destinazione C7260 — predisposta, non ancora attiva

Dopo conferma dell'operatore del nuovo collegamento, delle impostazioni Fiery (A4, scala di grigi, solo fronte, una copia, iP-A2 attesa) e di Test-Path True, creata nella sola V1 la stampante `Canon C7260 / iP-A2` con preferenza BW e destinazione `c7260-test-a4-bn`, nome `28PRINT_TEST_A4_BN720`, ID `ceffd445-273f-4734-a4d2-85088d09b636`. Riutilizza Bridge e profilo legacy; destinazione DISABILITATA fino alla conferma della mappatura locale. Nessuna modifica a IPC650, chiavi o lavori. Percorso confermato dall'operatore: `C:\Users\UTENTE\Desktop\Automazione 650\28PRINT_TEST_A4_BN720`; il percorso non è memorizzato nel database del gestionale. Restano modifica config Windows, controllo locale, riavvio, abilitazione esplicita e test di consegna C7260.

### C7260 abilitata — 16 ottobre, 16:35 CEST

L'operatore ha confermato modifica config, controllo permessi riuscito e successivo Avvia dal pannello (era rimasto in pausa). Verificato contatto server alle 16:35:07 CEST, recente di 13 secondi, e assenza di lavori pendenti. Abilitata esclusivamente la destinazione `c7260-test-a4-bn`. Unico lavoro ancora DELIVERED sulla IPC650; nessun nuovo job creato o approvato dall'agente. Prossimo passo: approvazione manuale esplicita di un nuovo invio del PDF sintetico alla C7260, con motivo del collaudo; ricezione su iP-A2 ancora da confermare.

## Invio rapido e inbox WhatsApp — pubblicati il 16 ottobre, 17:22 CEST

Preview Ready `dpl_DzvzsXNcnVsQLkTMcc4EM2AZiThE`, URL `https://28-print-gestionalev1-bpnxxtgfb-fedo28s-projects.vercel.app`. Aggiornato il solo alias stabile `https://28print-bridge-v1-preview.vercel.app`; nessun cambio necessario sul PC. Migrazione additiva `20261016170000_whatsapp_inbound_foundation` applicata al solo V1; nessun bootstrap o deploy operativo.

Nuovo pannello dall'allegato: anteprima PDF.js autenticata e vincolata all'hash, selezione profilo/stampante, approvazione senza cambio pagina, stato accanto al file e reinvio distinto. Inbox `/whatsapp` protetta da amministratore attivo; webhook esplicitamente DISATTIVATO (404), zero messaggi reali e nessuna credenziale Meta configurata. Numero ancora nell'app Business, nessun trasferimento o acquisto servizi. Dettagli e parti mancanti in `docs/PRINT-QUICK-AND-WHATSAPP.md`.

Verifiche: 23 test unitari/guardie + 17 integrazione; build, pagine locali e browser desktop/mobile con rendering PDF reale riusciti. Il test UI ha creato e rimosso esclusivamente fixture nel database locale, senza stampanti. Screenshot `output/print-ui/`. Verifica remota: alias corretto, protezione Vercel invariata, login 200, worker PDF 200, webhook 404, inbox richiede login. Rimangono soltanto i due lavori DELIVERED: IPC650 `b62b7652-ff8b-41c0-bcec-ef5f8cf8b009`, C7260 `8d8e8546-4d24-4cb8-a863-65530f8fe258`; entrambe le destinazioni abilitate, contatto Bridge aggiornato alle 17:23:57 CEST. Nessun invio remoto creato dall'agente.

## Avvisi da trattare separatamente

- **Needs Attention**: la UI segnala valori che sembrano segreti ma sono salvati come Config. Nessuna rotazione eseguita; va pianificata con aggiornamento coordinato delle dipendenze.
- Vercel segnala Node 20 non più supportato per nuovi build del progetto operativo. V1 mostra Node 24. Nessun upgrade del progetto operativo effettuato.
- Il suggerimento di collegare il plugin Vercel è facoltativo: l'ispezione e la configurazione dello storage sono state eseguite dal browser già autenticato.

Riferimento per l'accesso macchina: [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation). La chiave vale per tutti i deploy del progetto che la emette, non è limitata a una singola API; non generarne una nel progetto operativo per questo test.
