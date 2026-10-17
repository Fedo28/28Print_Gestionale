# Stampanti e profili — implementazione del 16 ottobre 2026

## Riutilizzo

Restano invariati il worker Windows, il protocollo di consegna, la pubblicazione nelle Hot Folders e il registro SQLite. Riutilizzati autenticazione amministratore, ordini/allegati, revisione PDF, impronta SHA, approvazione e coda. Nessuna modifica a catalogo, prezzi, notifiche, stampa browser o configurazione fisica Fiery.

## Funzioni aggiunte

- Impostazioni → Stampanti e profili: creazione/rinomina stampanti, preferenza B/N o colore, abilitazione/disabilitazione.
- Profili con nome, chiave, A4/A3, colore, lati, copie fisse e carta. Tutti descrivono una Hot Folder in attesa; l'orientamento attuale resta quello del PDF.
- Destinazioni logiche stampante/profilo/Bridge, create disabilitate. Il gestionale non riceve percorsi Windows. L'abilitazione richiede conferma manuale della mappatura e delle impostazioni fisiche.
- Nell'ordine: scelta del profilo e della stampante/Hot Folder; suggerimento per preferenza compatibile, sempre modificabile prima dell'approvazione.
- Profili e associazioni immutabili: si crea una nuova chiave per cambiare le proprietà fisiche. Disabilitare non cancella lavori o storico.
- Controlli server applicati ad approvazione, claim e autorizzazione al deposito. La disabilitazione non invalida la ricevuta di un deposito già autorizzato.
- La disabilitazione di stampanti/profili disabilita anche le destinazioni associate, così il blocco è rispettato anche dal vecchio endpoint durante la transizione. Riabilitare una stampante/profilo non riattiva le cartelle automaticamente: occorre una nuova conferma esplicita per ciascuna destinazione.

## Compatibilità e limiti espliciti

Il Bridge 0.2 installato supporta solo `A4_BW_SIMPLEX_1_HOLD_V1`. Altre stampanti possono usare quel profilo dopo mappatura locale e verifica della Hot Folder. Gli altri profili si possono preparare nel gestionale, ma non attivare per l'invio: il server li blocca, non solo l'interfaccia. Nessuna conversione JPEG, copie variabili, rotazione o ridimensionamento introdotti in questa modifica.

La migrazione additiva `20261016160000_print_configuration` conserva ID e chiavi delle destinazioni e dei lavori. Collega le destinazioni esistenti a stampanti e al profilo legacy; non crea Canon predefinite né inventa preferenze di smistamento. I profili storici sconosciuti restano non selezionabili. La migrazione è stata applicata al database locale isolato e successivamente alla Preview V1 autorizzata, mai alla produzione operativa.

## Pubblicazione V1 completata; cambio URL PC in attesa

Il 16 ottobre, dopo conferma dell'operatore che il Bridge era in pausa, pubblicato il deployment Preview `dpl_6zmCuKwQGvpjTtivhrsTD3KDGmwV` (Ready). URL immutabile: `https://28-print-gestionalev1-dv3o6oxfq-fedo28s-projects.vercel.app`. Alias stabile dedicato: `https://28print-bridge-v1-preview.vercel.app`. Nessun dominio esistente riassegnato, nessuna modifica alla produzione operativa.

Applicate a V1 entrambe le migrazioni pendenti (multisorgente e configurazione). Verifica successiva in sola lettura: unico lavoro ancora DELIVERED con stesso ID; destinazione `ipc650-test-a4-bn` ancora abilitata, stesso ID/chiave/profilo, collegata alla Canon IPC650 / G100. Verificati login HTTP 200, protezione Vercel sull'alias, reindirizzamento applicativo al login senza sessione e API Bridge HTTP 401 senza credenziale applicativa. Nessuna chiave generata o ruotata; bypass esistente usato solo in memoria. Nessun claim/invio o contatto Bridge simulato.

Resta da sostituire il solo `baseUrl` in `C:\28PRINT-Bridge\config.json`, chiudere/riaprire il pannello (che legge l'URL all'apertura), premere Avvia Bridge e confermare l'ultimo contatto sul nuovo alias. Non riapprovare il lavoro già consegnato. Fino alla conferma del PC, il cambio endpoint non è completato. Le nuove schermate autenticate sono state verificate localmente; resta la verifica visiva dell'operatore sulla Preview.

### Procedura e motivazioni conservate

Il PC punta a un URL di deployment Preview immutabile con il vecchio server. Quel vecchio endpoint non legge i nuovi flag stampante/profilo: per compatibilità la disabilitazione si propaga al flag `PrintDestination.enabled`, già rispettato dal vecchio server. Per usare il nuovo server e mantenere coerenti interfaccia, approvazione e API, coordinare comunque il cambio URL.

Prima di rendere utilizzabili i nuovi controlli remoti:

1. Terminare eventuali lavori in corso e mettere in pausa il Bridge.
2. Pubblicare esclusivamente nella Preview V1 verificata, con migrazioni additive e guardie di isolamento; nessun push/deploy dalla radice collegata al progetto operativo.
3. Verificare che restino invariati Bridge, credenziale, chiavi delle destinazioni e profilo legacy. Per questo aggiornamento della stessa Preview non è necessaria una nuova chiave; il passaggio alla produzione richiederà credenziali dedicate.
4. Configurare un URL Preview stabile per i successivi aggiornamenti e aggiornare il solo baseUrl locale. Conservare tutto il registro, i percorsi e le Hot Folders.
5. Riprendere il Bridge e verificare il nuovo contatto prima di abilitare altre destinazioni.

Non presentare il cambio endpoint come completato finché il PC non usa quello nuovo. Le vecchie pagine di approvazione non vanno riutilizzate dopo la migrazione multisorgente. Il passaggio alla produzione richiede una successiva autorizzazione e revisione storage; non è incluso in questo aggiornamento.

## Verifiche

16 test di integrazione locali: approvazioni e claim concorrenti, sicurezza credenziali, antiduplificazione, ricevute, flusso HTTP completo, ruolo amministratore, destinazioni nuove disabilitate, blocco profili non supportati, disabilitazione durante preparazione e conservazione delle ricevute già autorizzate.

13 test unitari/guardie Preview superati; compilazione Next.js e controllo TypeScript superati. Le pagine effettive della build locale hanno restituito HTTP 200 con i form di configurazione e i selettori profilo/stampante; nessun segreto nell'HTML verificato. Nessun invio reale o modifica al PC durante lo sviluppo.
