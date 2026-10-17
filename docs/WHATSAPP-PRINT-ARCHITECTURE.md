# 28PRINT — Modello WhatsApp per la stampa

> Aggiornamento 16 ottobre: le consegne Hold sono state collaudate su IPC650 e C7260; la migrazione multisorgente è su Preview V1. Sono ora implementati inbox e ricevitore firmato, ancora disattivato e senza acquisizione media. Il numero usa solo l'app WhatsApp Business. Stato attuale e limiti in [PRINT-QUICK-AND-WHATSAPP.md](PRINT-QUICK-AND-WHATSAPP.md); le sezioni seguenti conservano l'analisi iniziale, non certificano il collegamento reale.

## Stato attuale

Il gestionale oggi ha già un'integrazione WhatsApp **in uscita**: dal gestionale genera un link `wa.me` per avvisare il cliente che un ordine è pronto. Non esistono ancora webhook WhatsApp, ricezione di messaggi, acquisizione di allegati o collegamento automatico tra una chat e un ordine.

Quindi il pulsante desiderato — ricevere un documento su WhatsApp e approvarne la stampa senza scaricarlo manualmente sul PC — è realizzabile, ma richiede un canale WhatsApp Business con API ufficiali. Un semplice link `wa.me` o l'automazione di WhatsApp Web non è sufficiente per un flusso affidabile e mantenibile.

## Esperienza operatore proposta

1. Un PDF/JPEG arriva al numero WhatsApp Business.
2. Il gestionale riceve il webhook e mostra il documento in una casella “WhatsApp ricevuti”.
3. L'operatore collega il messaggio a un cliente/ordine, oppure crea una lavorazione interna.
4. Il gestionale mostra anteprima, nome file, formato e dati disponibili.
5. L'operatore preme **Approva e prepara stampa** e sceglie, se necessario, destinazione e profilo.
6. Il documento entra nella stessa coda `PrintJob` oggi usata dal prototipo sugli allegati agli ordini. Anche i file del Banco Online useranno questa coda quando verrà collegato il loro storage privato.
7. Il Bridge scarica il media tramite HTTPS, lo prepara e lo deposita nella Hot Folder.
8. Il gestionale mostra lo stato fino a **Consegnato alla Hot Folder**. “Stampato” resta separato e richiede conferma o verifica reale.

Il PC Windows non deve ricevere messaggi WhatsApp e non deve esporre porte: il suo unico compito resta quello già previsto per il Bridge.

## Componenti riutilizzabili

- `Customer.whatsapp` per il primo abbinamento al cliente.
- Ordini, commissioni, allegati e storage già presenti nel gestionale.
- Autenticazione operatori e ruoli esistenti.
- `PrintJob`, `PrintJobEvent`, destinazioni e ledger idempotente del Bridge.
- Preparazione PDF e deposito nella Hot Folder già previsti dal Bridge; la conversione JPEG è una fase successiva.
- Pannello di produzione e aggiornamento live degli stati.

## Componenti da aggiungere

### 1. Inbound WhatsApp

- endpoint pubblico `GET/POST /api/webhooks/whatsapp`;
- verifica della firma del provider;
- salvataggio di conversazione, messaggio, media ID, MIME type, nome file e timestamp;
- download server-side del media con token segreto, senza esporre credenziali al browser;
- deduplicazione su `providerMessageId` e `mediaId`;
- gestione dei messaggi non riconosciuti o senza ordine associato.

### 2. Sorgente unificata di stampa

La base comune è stata implementata: `PrintJob` ora contiene `sourceType` e `sourceId`; `orderId` e `attachmentId` sono facoltativi per le sorgenti future. I lavori precedenti vengono associati a `ORDER_ATTACHMENT` senza cambiare la chiave di deduplicazione. La migrazione è stata applicata solo al database locale isolato del test; non è stata distribuita su Vercel.

```text
PrintSourceType = ORDER_ATTACHMENT | SHOP_FILE | WHATSAPP_MEDIA | INTERNAL_DOCUMENT

PrintRequest/PrintJob:
  sourceType
  sourceId
  orderId?              // valorizzato quando esiste un ordine
  attachmentId?         // valorizzato per allegati già nel gestionale
  requestKey            // unico e idempotente
  sha256, fileSize, fileName
  approvedBy, approvedAt, status, events
```

Il punto di creazione del lavoro approvato è già condiviso internamente. L'adattatore WhatsApp dovrà validare e acquisire il media, verificare il documento e poi usare quel punto comune. Fino a quel momento il server consente al Bridge di scaricare soltanto `ORDER_ATTACHMENT`.

### 3. Interfaccia

- pagina/inbox “WhatsApp ricevuti”;
- stato “Da collegare”, “Pronto per verifica”, “Approvato”, “In stampa”, “Errore”;
- pulsante di approvazione visibile solo a operatori autorizzati;
- collegamento a ordine/cliente e scelta della stampante;
- cronologia messaggio e cronologia PrintJob nello stesso dettaglio.

## Decisione tecnica importante

Per la produzione non useremo automazione del browser WhatsApp Web: è fragile, difficile da proteggere e non offre una garanzia corretta di ricezione media. Serve WhatsApp Business Cloud API oppure un provider ufficiale compatibile. Il numero attuale va verificato: un normale account WhatsApp/WhatsApp Business usato solo dall'app non è automaticamente sufficiente per i webhook.

Prima dell'implementazione servono:

1. conferma del numero/provider da integrare;
2. accesso al Meta Business Portfolio, se si sceglie Cloud API;
3. decisione su come associare un messaggio a un ordine: numero cliente, codice ordine nel testo, oppure assegnazione manuale;
4. conferma che i documenti reali debbano stare in storage privato con URL firmati. Il Blob di test creato per il Bridge non va usato come archivio pubblico di documenti cliente.

## Piano di lavoro

### Fase A — Inbox senza stampa

Webhook, verifica firma, salvataggio messaggi/media e visualizzazione nel gestionale. Nessun invio a Fiery.

### Fase B — Approvazione unificata

Collegamento a ordine o lavorazione interna, anteprima, approvazione autorizzata e creazione idempotente del PrintJob. Lo schema e il servizio comune sono già preparati; restano l'adattatore, il media storage privato e l'interfaccia WhatsApp.

### Fase C — Bridge

Prima si verifica il test PDF su una sola Hot Folder. Poi si aggiunge l'accesso sicuro ai media WhatsApp e ai file privati del Banco Online, insieme a JPEG, destinazioni e profili completi.

### Fase D — Operatività

Retry, audit, permessi, retention dei media, gestione errori e conferma manuale dello stampato.

## Stato del Bridge al termine della giornata

Il Bridge è completo come prototipo software e non è ancora collaudato fisicamente sul PC Windows/Fiery. La parte non verificata è il test reale: installazione, autenticazione, download, deposito nella Hot Folder e controllo di un singolo job. Domani conviene chiudere quel test prima di abilitare qualsiasi stampa WhatsApp reale.
