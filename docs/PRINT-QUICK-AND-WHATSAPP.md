# Invio rapido e inbox WhatsApp — 16 ottobre 2026

Pubblicato sulla sola Preview V1: deployment `dpl_DzvzsXNcnVsQLkTMcc4EM2AZiThE`, alias stabile `https://28print-bridge-v1-preview.vercel.app`. Migrazione nuova applicata a V1. Worker, credenziali PC e produzione invariati. 40 test complessivi (23 unitari/guardie, 17 integrazione), build e prova browser locale desktop/mobile superati; verificati rendering canvas, singola approvazione, blocco duplicati, motivo di reinvio e inbox scollegata. Nessun invio reale durante questa modifica.

## Cosa cambia

Solo Preview con `printEnabled()`: rimosso il riquadro tecnico separato dall'ordine, allegati aperti e azione a fianco di ogni PDF. Il pannello modale mostra anteprima PDF.js locale (canvas e paginazione, nessuna azione/script del PDF), profilo disponibile e stampante consigliata modificabile. Un unico pulsante «Approva e invia» costituisce l'approvazione esplicita; la pagina non naviga altrove. Non vengono visualizzati hash o chiavi. Il registro tecnico resta disponibile per diagnosi/esiti incerti.

La lettura del PDF è protetta da utente amministratore attivo e hash della revisione. L'approvazione riusa `approvePrint`: ruolo verificato dal server, nuova verifica SHA, medesima chiave idempotente, blocchi di destinazione e registro. Nessun job viene creato aprendo l'anteprima. Reinvio distinto, con motivo obbligatorio; stato incerto o in corso blocca il reinvio. Il PC offline comporta avviso di accodamento, non falsa conferma della stampante online. «Consegnato» non significa «Stampato».

Il Bridge Windows e le impostazioni fisiche non cambiano. Gli unici profili inviabili restano quelli realmente supportati e già verificati. Nessuna opzione simulata per copie variabili, JPEG, fronte/retro o A3.

## WhatsApp: base reale, numero non collegato

Il titolare ha confermato che usa soltanto l'app WhatsApp Business. Nessuna migrazione del numero, accesso Meta, attivazione provider o spesa effettuati.

- `/whatsapp`: inbox amministrativa, ultimi 100 messaggi, conversazioni e riferimenti ai media. Stato esplicito di numero non collegato, nessun messaggio dimostrativo spacciato per reale.
- `/api/webhooks/whatsapp`: GET challenge con confronto costante, POST firma HMAC-SHA256 sui byte originali, payload massimo 256 KiB, massimo 100 messaggi, allowlist account/numero, persistenza atomica con deduplicazione. Restituisce 503 su errore DB per consentire retry. Non registra payload o segreti nei log.
- Tabella additiva `WhatsAppInboundMessage`; nessun collegamento automatico al cliente per semplice coincidenza di telefono, nessuna approvazione o risposta automatica.
- Ricevitore DISATTIVATO per default e sempre escluso dalla produzione. Per futuri test sintetici richiede `WHATSAPP_WEBHOOK_ENABLED=true`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TEST_ACCOUNT_ID`, `WHATSAPP_TEST_PHONE_NUMBER_ID`, oltre alle guardie Preview del Bridge. Segreti solo lato server, mai nel repository/browser.
- Nessun download media implementato in questa fase: niente documenti cliente nel Blob pubblico. Mancano connessione ufficiale del numero, acquisizione con token Meta, archivio privato, associazione al lavoro e adattatore `WHATSAPP_MEDIA` alla coda. Il pulsante stampa dei media non viene mostrato come funzionante.
- La protezione Vercel sull'intero progetto rimane: prima del collegamento esterno occorre progettare un ingresso webhook limitato e protetto dalla firma, senza disabilitare la protezione dell'intero gestionale né passare il bypass Vercel in URL.

## Hot Folders: evitare l'esplosione delle combinazioni

Il normale deposito PDF usa proprietà fissate nella cartella. Non esiste qui un servizio che crei automaticamente cartelle o modifichi il profilo Fiery per ogni ordine. JDF permette ticket per lavoro solo con controller compatibile e funzione abilitata; l'attuale versione di Command WorkStation non basta a certificarlo. Non attivato né promesso per IPC650/G100 o C7260/iP-A2.

Prima di far preparare nuove cartelle: verificare nelle impostazioni del controller e nei formati di ingresso la disponibilità effettiva di Fiery JDF. Se non disponibile, partire dai profili comuni: A4/A3, solo fronte/fronte-retro lungo, B/N sulla C7260 e colore sulla IPC650. Non una cartella per ogni numero di copie. Copie variabili, carte particolari e finiture restano impostazioni manuali in Fiery finché non viene collaudato un canale ticket compatibile. Le due Hot Folders attuali restano in attesa e invariate.

Fonti primarie consultate:

- [Fiery: JDF Filter](https://help.fiery.com/fieryhotfolders/4.1/en-us/GUID-C58C28AD-8D0E-4BCF-A1A8-8AABD29EA996.html): JDF richiede supporto e abilitazione sul server, ticket sostituisce proprietà/azione della Hot Folder. Non è conferma di compatibilità dei controller del negozio.
- [Meta: verifica webhook](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/): challenge e firma. SDK archiviato, non adottato come dipendenza; implementato il protocollo direttamente.
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/): rendering pagine su canvas. Pacchetto ufficiale fissato a 6.4.299, worker/font/wasm serviti localmente senza CDN.

## Prima della produzione

Occorrono revisione operatore della nuova UI, collaudo fisico esplicito (ad oggi consegne Hold verificate su entrambe le Canon), connessione Meta e storage privato, prova WhatsApp end-to-end e revisione dei permessi operatore. Il passaggio operativo non fa parte del deploy Preview e non si esegue automaticamente.

L'audit npm ha inoltre segnalato avvisi sulle dipendenze esistenti (Next, Prisma e altri; Next classificato critical). PDF.js non compare fra i pacchetti segnalati. Nessun `audit fix --force` o aggiornamento major effettuato: serve un intervento separato verificato prima del rollout operativo, non un upgrade distruttivo durante il collaudo.
