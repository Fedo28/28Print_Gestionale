# Ottimizzazione traffico Neon — 19 ottobre 2026

## Diagnosi corretta

La schermata del titolare mostra 42,03 CU-ore, 0,04 GB di storage e 4,01 GB di network transfer dal 1 ottobre. Il limite di traffico Free pubblicato da Neon è 5 GB/progetto: 4,01 GB corrispondono all'80,2%. La precedente attribuzione dell'avviso al compute e al Bridge non era supportata dai dati.

La configurazione documentata in `bridge/VERCEL-STATUS.md` separa Neon operativo da Prisma Postgres V1 (`db.prisma.io`). Anche il build V1 di questa modifica ha verificato destinazione e fingerprint del database isolato. Il polling Bridge resta un tema di costo futuro, ma non è dimostrato che causi l'avviso Neon attuale.

Fonte limiti: https://neon.com/pricing

## Correzioni

- `getOrdersTabCounts`: sei conteggi SQL restituiscono solo numeri quando ricerca e priorità automatica non richiedono elaborazione. Prima venivano scaricati sei elenchi completi con clienti, righe, incarichi e collegamenti shop.
- Ricerca e priorità attiva conservano le regole esistenti, selezionando solo i campi necessari. Ordini consegnati mantengono la priorità memorizzata. Il filtro autore risolve gli audit una sola volta per i sei contatori.
- Notifiche: nessuna richiesta nelle schede nascoste o offline; nessuna sovrapposizione di richieste lente; annullamento allo smontaggio; gli errori temporanei mantengono l'ultimo risultato valido. Ripresa alla visibilità/focus/riconnessione quando il risultato è scaduto.
- Workspace, ordini, produzione e siti: refresh automatico ogni 60 secondi invece di 30, con la stessa gestione visibilità/rete. Le azioni esplicite conservano i propri refresh.
- Prisma: riuso dell'istanza e del pool nello stesso processo anche in produzione. Nessun cambio remoto a DATABASE_URL o al piano Neon.

Non è una misura del risparmio complessivo: il volume reale dipenderà da pagine aperte, filtri e utenti. I consumi mensili già registrati non diminuiscono dopo una pubblicazione.

## Verifiche e pubblicazione

- 44 test unitari superati (conteggi/filtri, ricerca, dominio ordini, polling).
- 7 prove di integrazione PostgreSQL locale superate: contatori confrontati con le liste effettive per tutti i tab e diversi filtri. Fixture sintetiche rimosse a fine test.
- TypeScript e build Next.js locale completati; nessuna nuova migrazione.
- Preview V1 `dpl_CBYUUF82mPwB35NexMFchuSSDkUJ`: READY, build remoto riuscito, nessuna migrazione pendente.
- Alias `https://28print-bridge-v1-preview.vercel.app` aggiornato al deployment `https://28-print-gestionalev1-a87z0lxm5-fedo28s-projects.vercel.app`.
- Verifica browser remota: `/orders` reindirizza al login, come previsto senza sessione operatore. La prova funzionale autenticata remota resta da fare.

## Passaggio all'operativo

Al termine della prima fase le correzioni erano pubblicate solo su V1. `output/neon-optimization.patch` contiene esclusivamente queste modifiche e i relativi test (8 file), senza shop foto, dominio, WhatsApp o Bridge. Verificati applicabilità inversa nel checkout e identità dei file base tra HEAD e `main` locale (`3f0e33e2`). La successiva pubblicazione operativa è descritta qui sotto.

Il titolare ha autorizzato la sola ottimizzazione operativa il 19 ottobre 2026. Dopo l'applicazione, confrontare l'incremento di Network transfer su giornate di uso comparabili; circa 0,99 GB restano nel periodo mostrato. Il margine potrebbe non bastare fino al rinnovo e non è garantito che questa ottimizzazione eviti l'upgrade.

### Preparazione hotfix operativo

- Deployment precedente: `dpl_2FVDn3NWQxHKAN9LcXk1oBqHXLna` (`28-print-gestionale-nkwlegp99-fedo28s-projects.vercel.app`).
- `main` remoto resta `3f0e33e2`, ma il deployment contiene già la separazione dominio shop. Confrontate le impronte SHA-1 dei 379 file sorgente pubblicati con `2ca461e2`: tutto il codice applicativo corrisponde; differenze limitate a comando build e artefatti locali non applicativi. Pertanto l'hotfix parte da `2ca461e2`, non dal main incompleto.
- Copia isolata `/private/tmp/28print-neon-hotfix.TYZZFe`; ramo di recupero conservato anche nel repository principale: `codex/neon-usage-hotfix`, commit `a31ae534` (correzione `de62591f` e esclusioni pacchetto). Nessuna modifica al ramo di lavoro della Preview; nessun push/merge sul main.
- 49 test unitari passati sulla base operativa, incluso routing dominio; TypeScript superato.
- Comando build: `npm run deploy:check-env && npm run build`. Nessuna migrazione, seed o bootstrap. Configurazione regione e cron invariata. Esclusi dal pacchetto i report clienti locali, screenshot, template e test, senza cancellarli dal repository.
- Pubblicazione avviata con `--prod --skip-domain`: gli alias restano sulla versione precedente fino alla verifica del build.

### Pubblicazione operativa completata

- Deployment `dpl_3hRu795bAadd8wvAuXs3A2SwDnh4`, URL `https://28-print-gestionale-n3bxa4hyx-fedo28s-projects.vercel.app`: READY. Build remoto completato con lo schema operativo, controllo tipi riuscito, nessuna migrazione o bootstrap eseguiti.
- Promozione completata. Alias `28-print-gestionale.vercel.app` e `shop.28print.it` verificati sul nuovo deployment; alias Preview V1 invariato.
- Smoke test anonimi: login gestionale 200; `/orders` restituisce il redirect streaming Next.js `NEXT_REDIRECT;replace;/login;307;`; API notifiche ordini 401; radice shop 307 verso `/shop`; login amministrativo sul dominio shop 404.
- La verifica funzionale autenticata in produzione non è stata eseguita; coperta localmente da test unitari/integrazione e build. L'effettiva riduzione dei consumi Neon non è ancora misurata.
- Ricaricare una volta le schede già aperte per utilizzare il nuovo codice client. Nessun intervento Windows/Bridge richiesto.
- Il ramo locale `codex/neon-usage-hotfix` conserva il codice esatto del rilascio. NON fare un deploy diretto del vecchio `main`: è ancora privo sia della separazione dominio sia dell'ottimizzazione. Integrare questo ramo (o gli equivalenti commit) prima del prossimo rilascio ordinario. Nessun push/merge eseguito in questa fase.

### Proiezione indicativa

Assumendo che i 4,01 GB siano il consumo dei primi 19 giorni di ottobre e che l'uso resti comparabile:

- Senza riduzione: `4,01 / 19 * 31 = 6,54 GB` a fine mese.
- Dimezzando solo il traffico futuro: `4,01 + (4,01 / 19 * 12 * 0,50) = 5,28 GB`.
- Riducendo del 65% solo il traffico futuro: `4,01 + (4,01 / 19 * 12 * 0,35) = 4,90 GB`.
- Soglia per chiudere entro 5 GB: riduzione futura di circa il 61%.
- Compute a ritmo invariato: `42,03 / 19 * 31 = 68,57 CU-ore`, sotto le 100 incluse. Il risparmio sul traffico non si traduce automaticamente nella stessa percentuale sul compute.

Questi sono scenari, non misure o promesse di risparmio. I consumi già maturati non si azzerano. Il traffico del mese successivo, se l'uso resta comparabile e la riduzione effettiva fosse del 50%, sarebbe circa 3,27 GB su un mese di 31 giorni.

## Secondo intervento — 19 ottobre, ottimizzazioni rimanenti

Il titolare ha chiesto di procedere con le ottimizzazioni; la proposta di sospensione 20–08 è stata rinviata. Nessun blocco notturno, salvataggio differito, nuovo servizio o upgrade.

### Modifiche

- `/orders`: pagine da 50 righe. Totale e intervallo mostrati, Precedenti/Successivi con filtri conservati, cambi filtro/ordinamento ripartono dalla prima pagina. Selezioni multiple limitate alla pagina corrente e indicate in UI.
- Ricerca/ordinamento/priorità automatiche conservati: si legge una proiezione ridotta dei candidati e solo dopo si espandono i 50 ordini visibili. Non è una paginazione SQL completa: la scansione dei metadati rimane per preservare la ricerca italiana e gli ordinamenti esistenti. Il dettaglio completo non viene più caricato per tutti i risultati. La lista completa usata dai preventivi rimane invariata.
- Suggerimenti ricerca: proiezione ridotta, senza note, incarichi, righe o cliente completo. Nessuna modifica al matching o al ranking.
- Disabilitato il prefetch automatico dei dettagli nella tabella e dei filtri principali, evitando caricamenti prima del clic.
- Notifiche: un'unica query restituisce solo una firma del conteggio e degli otto elementi visibili. Quando la firma non cambia, risposta 304 senza ricaricare i contenuti. Modifiche al payload, sostituzioni a parità di numero e letture invalidano la firma. Autenticazione prima di qualsiasi query e nessuna cache pubblica/condivisa di dati personali. Nessuna cache persistente degli ordini è stata introdotta.
- Bridge server V1: il contatto è scritto al massimo ogni 30 secondi; autenticazione, revoca e transazioni di presa in carico rimangono attive a ogni richiesta.
- Bridge Windows 0.3: con base 15 secondi, cicli vuoti passano a 30 e poi 60 secondi. Lavoro/ricevute riportano all'intervallo base. Backoff rete e pausa cooperativa invariati. Nessun cambio a protocolli, registro SQLite, Hot Folders o credenziali.

### Verifiche

- 51 test unitari sulla base operativa; TypeScript riuscito.
- 9 test integrazione conteggi/paginazione/notifiche PostgreSQL locale: confronto di tutte le righe su due pagine, sei ordinamenti, due direzioni e viste attive/consegnate; confronto contatori e liste; firma notifiche.
- 18 test integrazione Bridge, incluso heartbeat senza riscritture ripetute e le protezioni già esistenti.
- 27 test del pacchetto Node Bridge + typecheck riusciti (riavvio, errori rete, pause, duplicati, backoff).
- I test d'integrazione condividono il database locale: eseguirli con `--no-file-parallelism`. La prima esecuzione parallela interferiva con il confronto di conteggi globali durante la rimozione delle fixture Bridge; la ripetizione seriale è riuscita.
- Build locale isolato riuscito. Browser headless desktop/mobile su 61 ordini sintetici: pagine 50+11, filtri conservati, navigazione avanti/indietro, HTTP 304 notifiche; nessun errore JS. Fixture eliminate. Screenshot in `output/neon-ui/`. Script ripetibile `scripts/check-neon-optimization-ui.mjs`.

### Rilasci

- Preview V1 READY: `dpl_4o7ULgBK4nHjuUPvt8iM5TLGeZAm`, `28-print-gestionalev1-7xj86djsk-fedo28s-projects.vercel.app`, nessuna migrazione pendente. Alias `28print-bridge-v1-preview.vercel.app` aggiornato; nessun cambio indirizzo sul PC.
- Operativo READY e promosso: `dpl_HgdmkbqTTy4hCfU45SahbGV8bgVu`, `28-print-gestionale-819gjctp5-fedo28s-projects.vercel.app`. Sorgente isolato conservato nel ramo locale `codex/neon-usage-hotfix`, commit `18b6d7ac`, senza novità shop/WhatsApp/Bridge. Impronte dei sei file applicativi modificati confrontate con il deployment: tutte corrispondenti. Build remoto riuscito senza migrazioni/bootstrap. Il vecchio main resta da integrare prima del prossimo rilascio ordinario.
- Pacchetto Windows: `output/bridge/28PRINT-Bridge-risparmio-2026-10-19-fa87adc1.zip`, 9 file inclusa verifica SHA-256, zero configurazioni/credenziali/dati runtime. Istruzioni in `bridge/AGGIORNAMENTO-RISPARMIO.txt`. NON applicato al PC remoto: serve l'operatore. Non cancellare mai `data`.

Risparmio misurabile dal codice: a coda vuota stabile, il Bridge aggiornato esegue il 75% di controlli in meno (15→60 secondi), non il 75% di consumo complessivo in meno. Il primo lavoro dopo inattività può attendere circa un minuto oltre ai tempi di rete. Finché non si aggiorna Windows questa riduzione dei controlli non è attiva. Il risparmio Neon complessivo resta da misurare nei giorni d'uso reale.

## Terzo intervento — 20 ottobre, pausa notturna richiesta dal titolare

La precedente decisione di rinvio è superata dalla richiesta esplicita di sospendere il gestionale e mostrare una pagina che ricordi di non modificare dati fino al mattino.

- Orario giornaliero 20:00 incluse – 08:00 escluse, `Europe/Rome`, inclusi weekend e cambio ora legale/solare. Politica pura condivisa in `bridge/src/service-hours.ts`.
- Middleware: redirect delle pagine operatore a `/sospensione`, API e POST/Server Actions bloccati con HTTP 503, messaggio chiaro e Retry-After. Prima delle query DB. Difesa aggiuntiva in `requireAuth` e autenticazione login per azioni inoltrate su route pubbliche.
- Pagina di sospensione senza DB o autenticazione, senza menu/prefetch del gestionale. Avviso da 19:50 nelle pagine già aperte, schermata di pausa dalle 20, ritorno automatico dell'interfaccia alle 8. Nessun salvataggio offline, differito o automatico di bozze. I form restano montati finché la scheda resta aperta, ma questo NON è una garanzia di recupero dei dati non salvati.
- Polling del browser sospeso mentre la schermata è attiva. I vecchi browser vanno ricaricati una volta; le richieste del vecchio codice sono comunque bloccate lato server dopo il rilascio.
- Shop pubblico, callback pagamenti, webhook e cron conservano i propri controlli e autenticazione; non vengono spenti. Non è garantito consumo notturno zero del database.
- Bridge server V1: claim notturno restituisce soltanto `job:null` e orario riapertura, senza query di autenticazione o coda e senza dati protetti. Renew/download/begin/report restano autenticati per concludere lavori iniziati e ricevute. Nessun cambio alle autorizzazioni di stampa o al registro anti-duplicati.
- Windows 0.4: nessun nuovo claim tra 20 e 8; il ciclo locale si sveglia ogni minuto senza rete a coda locale vuota. Lavori pendenti/ricevute possono terminare. Stato pannello `night_paused`, ripresa automatica entro circa un minuto dalle 8 con PC e Bridge attivi. Pausa manuale continua invece a disabilitare l'avvio finché l'operatore non sceglie Avvia.
- In produzione la funzione web è attiva per default; `NIGHT_PAUSE_ENABLED=false` è un interruttore server di emergenza (richiede rilascio coerente del codice client). In sviluppo/test si abilita con `NIGHT_PAUSE_ENABLED=true`. Non modifica la politica oraria del pacchetto Windows.

### Verifiche e pacchetto

- 18 test web mirati superati (middleware, auth, Bridge API simulata, polling, separazione host e autenticazione), 31 test Node Bridge e controlli TypeScript superati.
- Browser localhost desktop/mobile: layout senza overflow orizzontale; avviso prima delle 20, blocco alle 20 e ripresa alle 8 tramite orologio simulato; nessun errore JS. Script `scripts/check-night-pause-ui.mjs`; schermate `output/night-pause/`.
- Il build locale con PostgreSQL isolato non è stato eseguibile perché il vecchio cluster temporaneo non è più disponibile; non è stato ricreato né sostituito con un database remoto. Verifica UI tramite server locale con sole impostazioni locali di test, senza scritture, invii stampa o integrazioni esterne.
- ZIP Windows, da applicare una sola volta dopo Pausa Bridge: `output/bridge/28PRINT-Bridge-risparmio-2026-10-20-803dae01.zip`, SHA-256 `8992ca3c5a9898c0fe9045a5df9ec0f013241aeb3331016e7c24345217ad02d5`. Comprende anche il risparmio 0.3; dipendenze invariate. Non contiene configurazione reale, chiavi, registro SQLite, log o documenti cliente. NON installato sul PC remoto da questo Mac.

### Rilasci completati

- Preview V1: `dpl_CKF4G8EraE1E1DAHeJtQRnNhGBGk`, URL `https://28-print-gestionalev1-9h9jke78n-fedo28s-projects.vercel.app`, READY. Alias stabile aggiornato, build con guardie di isolamento superato, nessuna migrazione pendente. Il primo tentativo CLI ha risposto Not authorized; verifica in lettura di account/progetto riuscita e successivo deploy con progetto/team espliciti riuscito senza cambiare credenziali o permessi.
- Operativo: `dpl_8JtNUFe1o3WrGYBiogtRDHyxGBoP`, URL `https://28-print-gestionale-mn86tnn3k-fedo28s-projects.vercel.app`, READY e promosso. Solo hotfix da checkout isolato `/private/tmp/28print-neon-hotfix.TYZZFe`, ramo locale `codex/neon-usage-hotfix`, commit `77e9b9ed` (conservato anche nel repository principale). Nessuna migrazione/seed/bootstrap né nuove funzioni Preview in produzione.
- Base operativa: 15 test mirati e TypeScript superati; entrambi i build remoti riusciti. Smoke test con sessione Vercel: `/sospensione` e `/login` HTTP 200 su entrambi i deployment. Sul dominio operativo pubblico: sospensione 200, login diurno 200, API notifiche non autenticata 401; shop radice reindirizza a `/shop` e rimane separato dal gestionale.
- I passaggi 20/08 e DST sono stati verificati con orologio simulato, non attendendo la notte reale. Nessun test di stampa fisica e nessun aggiornamento Windows eseguito da questo Mac.
- Il main GitHub resta da integrare prima di un futuro rilascio ordinario. Nessun push/merge eseguito. Il vecchio ZIP del 19 ottobre NON include la pausa notturna: usare quello del 20 ottobre.
