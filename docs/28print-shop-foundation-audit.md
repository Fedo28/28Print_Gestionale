# 28Print Shop Foundation Audit

Data audit: 2026-08-27
Branch: `feature/shop-foundation`
Scope: analisi del gestionale esistente e proposta architetturale per integrare shop, account cliente, pricing condiviso, file, pagamenti, ordini e commesse senza refactoring distruttivi nella prima fase.

## 1. Executive Summary

Il repository attuale e una singola applicazione Next.js 14 App Router orientata al gestionale interno. La base tecnica e riutilizzabile, ma oggi il dominio "ordine" e gia carico di responsabilita operative: cliente, righe, stato produzione, storico, pagamenti manuali, allegati e logiche da preventivo.

I punti piu forti da riusare sono:

- stack Next.js + Prisma + PostgreSQL gia operativo;
- catalogo servizi esistente con import da Excel e supporto a scaglioni quantita;
- funzioni di pricing gia centralizzate lato dominio;
- gestione clienti, storico ordini, audit log e impostazioni applicative;
- pattern di upload diretto browser -> storage gia presente;
- deploy Vercel gia strutturato.

I limiti principali da risolvere prima dello shop sono:

- `Order` oggi funziona di fatto come commessa/ordine operativo del gestionale, non come ordine cliente e-commerce;
- autenticazione pensata solo per staff interno (`ADMIN` / `OPERATOR`);
- catalogo troppo piatto per configuratori prodotto evolutivi;
- pricing con alcune euristiche hardcoded su nome/codice prodotto;
- file di produzione salvati oggi con URL Blob pubblici;
- assenza di carrello, billing snapshot, webhook di pagamento e modello idempotente per eventi esterni;
- concentrazione di dominio in pochi file grandi (`lib/orders.ts`, `app/actions.ts`, `components/order-form.tsx`).

Raccomandazione finale: adottare come architettura target la soluzione **C (monorepo con moduli condivisi)**, ma in modo graduale. Nella prima fase pratica non conviene ancora spostare tutto: conviene prima estrarre moduli condivisi nel repo corrente, introdurre le nuove entita e solo dopo dividere in due app (`shop` e `gestionale`) sopra quei moduli.

## 2. Audit del progetto attuale

## 2.1 Struttura attuale del progetto

Struttura principale del repository:

```text
/app
  /api
  /customers
  /orders
  /quotes
  /settings
  /stats
  /production
  /calendar
  /billboards
  /purchase-notes

/components
/lib
/prisma
  schema.prisma
  /migrations
  seed.ts

/scripts
/tests
```

Osservazioni:

- tutto vive in una singola app Next.js;
- non esistono ancora moduli separati per `shop`, `customer-account`, `payments` o `web-orders`;
- la UI del gestionale e molto ricca, ma pensata per utenti interni loggati.

## 2.2 Tecnologie utilizzate

Tecnologie rilevate da `package.json`:

- Next.js `14.2.35`
- React `18.3.1`
- React DOM `18.3.1`
- TypeScript `5.8.2`
- Prisma `6.19.1`
- PostgreSQL come database
- `@vercel/blob` `^2.3.1`
- `xlsx` `^0.18.5`
- `vitest` `3.0.8`
- Node `20.x`

Dipendenze architetturalmente importanti:

- `@vercel/blob`: upload e storage file;
- `sharp`: probabile supporto immagini/media server-side;
- `xlsx`: import catalogo e fogli di lavoro;
- `vitest`: suite di test utility/domain.

## 2.3 Versione e struttura Next.js

Il progetto usa:

- App Router (`/app`, nessuna cartella `/pages`);
- Server Components di default;
- Route Handlers in `/app/api/...`;
- Server Actions centralizzate in `app/actions.ts`;
- layout globale unico in `app/layout.tsx`;
- shell navigazionale del gestionale in `components/app-shell.tsx`.

Note tecniche:

- `next.config.mjs` imposta `experimental.serverActions.bodySizeLimit = "8mb"`;
- build di produzione usa `distDir = ".next"`, sviluppo `.next-dev`;
- tutte le pagine operative richiedono autenticazione staff, tranne `/login`.

## 2.4 Struttura database attuale

Il database e modellato in `prisma/schema.prisma`.

Entita principali attuali:

- `User`
  - utenti staff interni;
  - campi: `name`, `nickname`, `email`, `passwordHash`, `role`, `active`.

- `Customer`
  - anagrafica cliente unica per il gestionale;
  - campi: `name`, `type`, `phone`, `whatsapp`, `email`, `pec`, `taxCode`, `vatNumber`, `uniqueCode`, `notes`.

- `Order`
  - entita centrale del gestionale;
  - contiene sia dati commerciali sia dati operativi;
  - campi: `customerId`, `orderCode`, `title`, `deliveryAt`, `appointmentAt`, `priority`, `isQuote`, `mainPhase`, `operationalStatus`, `paymentStatus`, `invoiceStatus`, `totalCents`, `paidCents`, `balanceDueCents`, `notes`.

- `OrderItem`
  - righe dell'ordine;
  - campi: `serviceCatalogId`, `label`, `quantity`, `catalogBasePriceCents`, `discountMode`, `extraMode`, `unitPriceCents`, `lineTotalCents`, `format`, `material`, `finishing`, `notes`.

- `ServiceCatalog`
  - catalogo/prezzi del gestionale;
  - campi: `code`, `name`, `description`, `basePriceCents`, `unit`, `quantityTiers`, `active`.

- `Attachment`
  - allegati collegati solo a `Order`;
  - campi: `fileName`, `filePath`, `mimeType`, `sizeBytes`.

- `Payment`
  - registrazioni pagamento interne/manuali;
  - campi: `amountCents`, `method`, `status`, `effectiveAt`, `correctedPaymentId`.

- `OrderHistory`
  - storico operativo dell'ordine;
  - eventi: creazione, update, phase change, status change, payment, attachment, note.

- `AuditLog`
  - audit cross-entity;
  - registra create/update/delete su order, customer, catalogo, impostazioni, staff.

- `AppSetting`
  - key/value per impostazioni applicative.

- `PurchaseNote`
  - note di acquisto/magazzino collegate opzionalmente a cliente/ordine.

- `BillboardAsset` / `BillboardBooking`
  - modulo cartelloni/monitor, separato dal perimetro shop.

Mancano oggi:

- account cliente autenticabile;
- indirizzi cliente;
- profilo fatturazione dedicato;
- carrello;
- billing snapshot per ordine;
- ordine e-commerce separato da commessa;
- file asset generici collegabili a piu entita;
- pagamento provider/webhook/event log;
- coda eventi/notifiche.

## 2.5 Sistema autenticazione

L'autenticazione attuale e custom e orientata allo staff:

- cookie sessione: `fede_session`;
- payload sessione firmato con HMAC SHA-256;
- secret letto da `AUTH_SECRET`;
- password hashate con `scrypt`;
- sessione valida 12 ore;
- login via `nickname + password`, non via email;
- ruoli disponibili: `ADMIN`, `OPERATOR`.

Protezione accessi:

- `requireAuth()` per le pagine interne;
- `requireAdmin()` per funzionalita amministrative;
- `readSession()` usato anche nelle API route.

Limiti rispetto allo shop:

- nessuna registrazione cliente self-service;
- nessuna verifica email;
- nessun reset password;
- nessun modello per piu utenti cliente;
- stesso schema auth non adatto a pubblico esterno e backoffice insieme senza hardening aggiuntivo.

## 2.6 Gestione utenti

La gestione utenti esistente copre solo lo staff interno:

- creazione profili staff;
- attivazione/disattivazione;
- impostazioni invito staff via email;
- profilo personale con nickname.

Questa parte e riutilizzabile per il gestionale, ma non per gli account clienti dello shop. E corretto mantenere separati:

- `User` per operatori/amministratori;
- una nuova entita `CustomerAccount` per clienti.

## 2.7 Struttura clienti

`Customer` e una buona base anagrafica condivisa, ma oggi e insufficiente per e-commerce.

Punti forti:

- modello unico gia usato da ordini, preventivi e altri moduli;
- supporta pubblico/azienda;
- contiene gia campi utili a contatto e fatturazione base;
- e gia integrato in ricerca, scheda cliente e storico.

Gap:

- niente indirizzi multipli;
- niente default billing/shipping;
- niente storicizzazione dati fatturazione per singolo ordine;
- email non unica e non pensata come credential di login;
- nessuna relazione con account cliente autenticati.

## 2.8 Struttura commesse / ordini nel gestionale

Qui sta il punto architetturale piu importante.

Oggi `Order` nel codice rappresenta contemporaneamente:

- ordine commerciale;
- preventivo (`isQuote`);
- oggetto schedulabile (`deliveryAt`, `appointmentAt`);
- oggetto di produzione (`mainPhase`, `operationalStatus`);
- oggetto amministrativo (`invoiceStatus`);
- oggetto finanziario (`paymentStatus`, `paidCents`);
- contenitore file (`attachments`);
- contenitore storico e audit.

Questo significa che nel gestionale non esiste ancora una distinzione strutturale tra:

- `Order` acquistato dal cliente;
- `Job` / `Commessa` da produrre internamente.

Conclusione pratica:

- per lo shop non consiglio di riusare direttamente l'attuale `Order` come ordine cliente e-commerce;
- conviene introdurre una nuova entita `SalesOrder` (o `WebOrder`) e lasciare l'attuale `Order` come base della commessa operativa fino a migrazione piu matura.

## 2.9 Catalogo prezzi esistente

Il catalogo attuale e in `ServiceCatalog`.

Cosa contiene gia:

- codice servizio;
- nome;
- descrizione;
- prezzo base;
- unita (`PZ`, `MQ`, `ML`);
- scaglioni quantita serializzati in `quantityTiers`;
- stato attivo/disattivo.

Funzioni gia presenti:

- import catalogo da file Excel;
- bootstrap automatico da template se il catalogo e vuoto;
- ricerca catalogo;
- utilizzo del catalogo nei form ordine e preventivo;
- normalizzazione automatica dei codici servizio.

Valutazione:

- ottima base come single source of truth iniziale;
- non va sostituito con un secondo catalogo separato;
- va esteso per supportare pubblicazione sullo shop, configuratori, policy file e regole di generazione commessa.

## 2.10 Logica di pricing esistente

La logica prezzo attuale e relativamente centralizzata in `lib/pricing.ts` e usata dal dominio ordine.

Capacita gia presenti:

- prezzi base;
- prezzi per unita o per totale riga;
- scaglioni quantita;
- sconti/importi/percentuali;
- extra/importi/percentuali;
- ricalcolo totale riga e totale ordine;
- normalizzazione quantita;
- parse/normalize di `quantityTiers`.

Punti positivi:

- il browser non e l'unica fonte del prezzo: il dominio ricalcola i totali in creazione ordine;
- esistono test unitari di dominio e pricing.

Limiti da correggere:

- alcune regole dipendono da euristiche su nome/codice prodotto (`usesLineTotalQuantityTiers`, servizi fotografia, etichette);
- parte dell'esperienza prodotto vive in `components/order-form.tsx`, che e molto grande e contiene logica specifica di alcuni prodotti;
- non esiste ancora un pricing engine esposto come servizio riusabile per shop + gestionale;
- manca uno snapshot/versionamento regole al momento dell'ordine.

## 2.11 API gia disponibili

API route attuali rilevate:

- `GET /api/search`
  - ricerca globale interna al gestionale.
- `GET /api/order-search`
  - suggerimenti ordini/preventivi filtrati.
- `POST /api/services`
  - creazione servizio catalogo.
- `PATCH /api/services`
  - attivazione/disattivazione servizio catalogo.
- `POST /api/settings/catalog/import`
  - import catalogo da Excel.
- `POST /api/orders/[id]/attachments`
  - upload allegati, con supporto a direct upload Blob.
- `POST /api/orders/[id]/mark-ready`
  - cambio stato ordine pronto.
- `POST /api/orders/[id]/whatsapp`
  - genera link WhatsApp e marca notifica inviata.

In piu esiste un layer importante di Server Actions in `app/actions.ts` per:

- clienti;
- ordini/preventivi;
- righe ordine;
- pagamenti manuali;
- cartelloni;
- catalogo servizi;
- staff;
- audit.

Gap API rispetto allo shop:

- nessuna API pubblica per catalogo shop;
- nessuna API pricing/quote server-side;
- nessuna API carrello;
- nessuna API checkout;
- nessuna API customer account;
- nessun webhook provider pagamento;
- nessuna API per signed download di file privati.

## 2.12 Dipendenze principali

Dipendenze core gia utili al nuovo ecosistema:

- `next`: UI, route handlers, server actions;
- `@prisma/client` + `prisma`: data layer e migrazioni;
- `@vercel/blob`: upload diretto e storage;
- `xlsx`: ingest catalogo;
- `vitest`: regressioni su utility/domain.

Dipendenze mancanti per il perimetro shop:

- provider pagamenti (`stripe`);
- eventuale validazione schema runtime piu esplicita per payload pubblici;
- eventuale libreria email transazionale strutturata lato provider gia c'e via `fetch` su Resend, ma manca un modulo eventi/notifiche piu ampio.

## 2.13 Deploy Vercel

Stato attuale deploy:

- il progetto e predisposto per Vercel;
- `vercel.json` usa `buildCommand: npm run vercel-build`;
- regione impostata: `fra1`;
- la build di produzione esegue:
  - validazione env;
  - `prisma migrate deploy`;
  - bootstrap produzione;
  - `next build`.

Questo e compatibile con una prima evoluzione dello shop, a patto di mantenere:

- upload file pesanti via client upload;
- webhook pagamento idempotenti e veloci;
- separazione netta tra route pubbliche e backoffice.

## 2.14 Variabili ambiente rilevanti

Env attualmente dichiarate:

- `DATABASE_URL`
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `LOCAL_DEMO_DATA`
- `STAFF_ACCESS_BASE_URL`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_REPLY_TO`

Env che serviranno quasi certamente per il nuovo perimetro:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SHOP_BASE_URL`
- `SHOP_APP_BASE_URL`
- eventuali env storage dedicate se si separa il progetto upload/download.

## 2.15 Parti del gestionale riutilizzabili

Riutilizzo consigliato immediato:

- `Customer` come anagrafica centrale, estesa ma non sostituita;
- `ServiceCatalog` come sorgente centrale prodotti/prezzi;
- `lib/pricing.ts` come base da rifattorizzare in pricing engine condiviso;
- upload diretto browser -> Blob come pattern di partenza;
- `OrderHistory` / `AuditLog` come base tracciamento;
- `AppSetting` per configurazioni operative;
- pipeline import catalogo Excel;
- staff auth attuale per il solo gestionale.

Riutilizzo consigliato con cautela:

- `Order` attuale: bene come commessa operativa, non come ordine cliente shop;
- `Payment` attuale: bene come ledger interno/manuale, non come integrazione provider;
- `Attachment`: bene come riferimento storico attuale, ma troppo legato a `Order`.

## 2.16 Problemi architetturali rilevati

Problemi principali:

1. Dominio troppo accentrato in pochi file
   - `lib/orders.ts`: 3879 linee
   - `components/order-form.tsx`: 3090 linee
   - `app/actions.ts`: 1754 linee

2. Confusione semantica tra ordine e commessa
   - l'entita `Order` copre troppi sottodomini diversi.

3. Catalogo non ancora modellato per configuratori estensibili
   - `ServiceCatalog` e flat;
   - opzioni prodotto e regole complesse non sono modellate.

4. Pricing parzialmente hardcoded
   - alcune regole dipendono da naming conventions invece che da metadati strutturati.

5. Auth staff-only
   - impossibile aprire in sicurezza il perimetro al cliente finale senza un secondo layer auth.

6. File sensibili non abbastanza protetti per lo scenario shop
   - l'implementazione attuale usa Blob con `access: "public"` per upload diretti.

7. Nessun modello eventi/webhook/idempotenza
   - rischio alto appena si integra un provider di pagamento.

8. Nessuna separazione fisica attuale tra perimetro pubblico e backoffice
   - oggi e tutto una sola app, un solo shell, una sola navigazione interna.

9. Nessuno script `lint`
   - la quality gate attuale si appoggia a test e type safety, ma manca un controllo statico dedicato.

## 2.17 Debito tecnico che puo ostacolare il progetto

Debiti tecnici con impatto concreto:

- grossi moduli monolitici rendono piu costosa l'estrazione di logica condivisa;
- form ordine attuale mescola UX, pricing e logiche prodotto;
- forte coupling tra dominio gestionale e shape attuale del DB;
- assenza di confini tra perimetro interno e pubblico;
- assenza di versionamento esplicito del prezzo applicato all'ordine;
- assenza di modello per file privati con autorizzazione applicativa.

## 2.18 Test esistenti

La suite Vitest copre gia parti utili:

- auth;
- ordini e pricing di dominio;
- import catalogo;
- storage e attachment utilities;
- ricerca;
- staff users;
- billboards e utility varie.

Valutazione:

- buona base di test unitari;
- mancano test di integrazione end-to-end sui flussi multi-step che serviranno per shop, checkout, upload e webhook.

## 3. Confronto architetturale A / B / C

## 3.1 Soluzione A - Singola applicazione

Definizione:

- un solo progetto Next.js;
- route group separate per `gestionale` e `shop`;
- un solo deploy applicativo, eventualmente multi-domain.

Vantaggi:

- minimo impatto iniziale sul repository;
- riuso diretto del codice esistente;
- setup tecnico piu semplice;
- meno attrito nelle prime iterazioni.

Svantaggi:

- perimetro pubblico e perimetro interno convivono nella stessa applicazione;
- blast radius piu alto su deploy e regressioni;
- auth customer e auth staff restano troppo vicine;
- build piu pesante nel tempo;
- confini di dominio meno chiari.

Difficolta:

- bassa all'inizio, media nel medio periodo.

Impatto sul progetto esistente:

- basso inizialmente.

Manutenzione futura:

- discreta per MVP breve;
- peggiore quando catalogo, checkout, account cliente e notifiche cresceranno.

Valutazione:

- valida solo come ponte temporaneo, non come architettura finale consigliata.

## 3.2 Soluzione B - Due applicazioni nello stesso repository

Definizione:

- due app Next.js distinte nello stesso repository;
- una per `gestionale`, una per `shop`;
- condivisione codice tramite cartelle comuni o workspace leggeri.

Vantaggi:

- separazione funzionale piu chiara;
- deploy indipendenti;
- perimetro shop e backoffice meno accoppiati.

Svantaggi:

- se non si introducono veri moduli condivisi, si rischia duplicazione;
- gestione dipendenze, path alias e script piu scomoda di un monorepo fatto bene;
- puo diventare una "quasi monorepo" meno ordinata del necessario.

Difficolta:

- media.

Impatto sul progetto esistente:

- medio.

Manutenzione futura:

- migliore di A, ma dipende molto da come si condivide il dominio.

Valutazione:

- migliore di A, ma come endpoint finale ha senso solo se si vuole evitare tooling monorepo. Se dobbiamo condividere database, pricing, catalogo, auth cliente e file policy, conviene fare un passo in piu e andare verso C.

## 3.3 Soluzione C - Monorepo con moduli condivisi

Definizione:

- `apps/gestionale`
- `apps/shop`
- `packages/...` per dominio condiviso.

Vantaggi:

- migliore allineamento con il target funzionale richiesto;
- separazione netta tra UI pubblica e gestionale;
- deploy indipendenti ma logica condivisa;
- catalogo, pricing, ordini, file e pagamenti possono avere un unico cuore business;
- facilita test mirati per package/domain;
- riduce rischio di doppie implementazioni.

Svantaggi:

- setup iniziale piu impegnativo;
- richiede estrazione disciplinata dei moduli oggi annidati in file grandi;
- serve aggiornare script build/dev/deploy.

Difficolta:

- alta nella fase di transizione, medio-bassa dopo l'assestamento.

Impatto sul progetto esistente:

- medio-alto se fatto subito in modo drastico;
- medio se preparato in due fasi.

Manutenzione futura:

- la migliore delle tre.

Valutazione:

- e l'architettura finale consigliata.

## 4. Raccomandazione

Raccomando la **soluzione C come target architetturale**, ma con questa sequenza:

### Fase 1 - Senza migrare subito a monorepo

Nel repository attuale:

- estrarre moduli dominio condivisi da `lib/orders.ts` e `app/actions.ts`;
- introdurre le nuove entita database per shop senza toccare in modo distruttivo i flussi del gestionale;
- costruire lo skeleton shop e il pricing engine sopra moduli condivisi;
- mantenere il gestionale attuale operativo.

### Fase 2 - Split applicativo

Quando i moduli condivisi sono stabili:

- spostare il gestionale in `apps/gestionale`;
- creare `apps/shop`;
- portare il dominio condiviso in `packages`.

Perche non consiglio A come approdo finale:

- il progetto ha gia un dominio abbastanza ricco;
- shop e gestionale avranno ritmi di cambiamento diversi;
- pagamenti, upload e customer auth meritano un perimetro separato;
- il rischio operativo sul backoffice sarebbe troppo alto.

Perche non consiglio B come architettura finale:

- se esistono due app e moduli condivisi centrali, il monorepo e la forma piu pulita di B.

## 5. Proposta di architettura target

## 5.1 Principi

Principi guida:

- single source of truth per catalogo e pricing;
- server-side authority su prezzo, pagamento, permessi e stato;
- separazione tra ordine cliente e commessa operativa;
- file privati con accesso autorizzato;
- eventi idempotenti;
- moduli business riusabili da shop e gestionale;
- UI separata dalla business logic.

## 5.2 Struttura applicativa proposta

Target finale:

```text
/apps
  /gestionale
    /app
  /shop
    /app

/packages
  /db
  /auth-staff
  /auth-customer
  /catalog
  /pricing
  /commerce
  /files
  /payments
  /jobs
  /notifications
  /shared
```

Se nella prima fase si resta single-app, conviene gia imitare questi confini dentro il repo corrente:

```text
/lib/domain/catalog
/lib/domain/pricing
/lib/domain/commerce
/lib/domain/files
/lib/domain/jobs
/lib/domain/notifications
/lib/domain/customers
```

## 5.3 Struttura database aggiornata

### Da mantenere

- `User`
- `Customer` (estesa)
- `ServiceCatalog` (estesa)
- `Order` attuale come base commessa interna nella fase di transizione
- `OrderHistory`
- `AuditLog`
- `AppSetting`

### Nuove entita consigliate

- `CustomerAccount`
  - login cliente;
  - campi: `customerId`, `email`, `emailNormalized`, `passwordHash`, `active`, `emailVerifiedAt`, `lastLoginAt`.

- `CustomerAddress`
  - indirizzi spedizione/fatturazione;
  - campi: `customerId`, `type`, `label`, `line1`, `line2`, `postalCode`, `city`, `province`, `country`, `isDefault`.

- `CustomerBillingProfile`
  - profili fatturazione riutilizzabili;
  - campi: `customerId`, `kind`, `fullName`, `companyName`, `taxCode`, `vatNumber`, `sdiCode`, `pec`, `address fields`.

- `Cart`
  - carrello persistente per cliente autenticato o sessione anonima temporanea;
  - campi: `customerAccountId?`, `guestToken?`, `status`, `currency`, `expiresAt`.

- `CartItem`
  - righe configurate del carrello;
  - campi: `cartId`, `serviceCatalogId`, `configurationJson`, `pricingSnapshotJson`, `quantity`, `unitPriceCents`, `lineTotalCents`.

- `SalesOrder`
  - nuovo ordine cliente / e-commerce;
  - campi:
    - `customerId`
    - `customerAccountId`
    - `channel` (`SHOP`, in futuro `BACKOFFICE`, `PHONE`, ecc.)
    - `status` (`DRAFT`, `PENDING_PAYMENT`, `PAID`, `PAYMENT_FAILED`, `CANCELLED`, `FULFILLED`)
    - `invoiceRequested`
    - `currency`
    - `subtotalCents`
    - `discountCents`
    - `extraCents`
    - `totalCents`
    - `notes`
    - `placedAt`
    - `paidAt`

- `SalesOrderItem`
  - righe dell'ordine cliente;
  - campi:
    - `salesOrderId`
    - `serviceCatalogId`
    - `serviceCodeSnapshot`
    - `serviceNameSnapshot`
    - `configurationJson`
    - `pricingSnapshotJson`
    - `quantity`
    - `unitPriceCents`
    - `lineTotalCents`
    - `createJobAutomaticallyResolved`

- `SalesOrderBillingSnapshot`
  - snapshot fatturazione 1:1 con ordine;
  - campi:
    - `salesOrderId`
    - `kind`
    - `fullName`
    - `companyName`
    - `taxCode`
    - `vatNumber`
    - `sdiCode`
    - `pec`
    - `address fields`
    - `rawJson`

- `FileAsset`
  - archivio file privato e riusabile;
  - campi:
    - `ownerCustomerId`
    - `originalName`
    - `mimeType`
    - `fileSize`
    - `storageProvider`
    - `storageKey`
    - `storagePath`
    - `visibility`
    - `expiresAt`
    - `uploadedByCustomerAccountId?`

- `SalesOrderItemFile`
  - join table tra riga ordine e file asset.

- `PaymentRecord`
  - tracking pagamento provider;
  - campi:
    - `salesOrderId`
    - `provider` (`STRIPE`)
    - `providerCheckoutSessionId`
    - `providerPaymentIntentId`
    - `amountCents`
    - `currency`
    - `status` (`CREATED`, `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `CANCELLED`)
    - `paidAt`
    - `failureCode`
    - `failureMessage`
    - `rawProviderSnapshotJson`

- `PaymentWebhookEvent`
  - idempotenza ed audit webhook;
  - campi:
    - `provider`
    - `providerEventId` unique
    - `eventType`
    - `objectId`
    - `payloadJson`
    - `processedAt`
    - `processingStatus`

- `SalesOrderJobLink`
  - collega ordine cliente e commesse generate;
  - campi:
    - `salesOrderId`
    - `salesOrderItemId`
    - `orderId` (attuale tabella `Order`)
    - `linkReason` (`AUTO_PRODUCT_POLICY`, `INVOICE_REQUESTED`, `MANUAL`)

- `DomainEvent`
  - outbox eventi interni;
  - campi:
    - `topic`
    - `entityType`
    - `entityId`
    - `dedupeKey` unique
    - `payloadJson`
    - `status`
    - `createdAt`
    - `processedAt`

## 5.4 Migrazioni necessarie consigliate

Ordine suggerito, senza refactoring distruttivi:

1. Migrazione customer identity
   - `CustomerAccount`
   - `CustomerAddress`
   - `CustomerBillingProfile`

2. Migrazione catalogo shop-ready
   - estensioni a `ServiceCatalog` per visibilita e configurazione;
   - opzionalmente tabelle di supporto pricing/config.

3. Migrazione commerce core
   - `Cart`, `CartItem`, `SalesOrder`, `SalesOrderItem`, `SalesOrderBillingSnapshot`.

4. Migrazione file core
   - `FileAsset`, `SalesOrderItemFile`.

5. Migrazione pagamenti
   - `PaymentRecord`, `PaymentWebhookEvent`.

6. Migrazione integrazione commesse
   - `SalesOrderJobLink`;
   - eventuale nuovo stato operativo `IN_ATTESA_PAGAMENTO` nel gestionale.

7. Migrazione notifiche/eventi
   - `DomainEvent`.

Importante:

- non rinominare subito la tabella `Order`;
- non eliminare subito `Attachment`;
- introdurre il nuovo dominio in parallelo e migrare per gradi.

## 5.5 Strategia per riutilizzare il catalogo prezzi

Strategia consigliata:

1. `ServiceCatalog` resta la sorgente centrale.
2. Lo shop non possiede un secondo listino indipendente.
3. Ogni prodotto pubblicato online usa:
   - record centrale in `ServiceCatalog`;
   - metadati shop/configuratore;
   - regole pricing collegate al servizio.
4. Al checkout si salva sempre uno snapshot del prezzo applicato.

Campi da aggiungere o estendere su `ServiceCatalog`:

- `onlineActive`
- `onlineSlug`
- `productFamily`
- `createJobAutomatically`
- `configurationSchemaJson`
- `pricingSchemaJson`
- `filePolicyJson`
- `productionPolicyJson`
- `sortOrder`

Questo non crea un secondo catalogo: aggiunge solo metadati per canale e configuratore.

## 5.6 Architettura del pricing engine

Obiettivo:

- un solo motore prezzi per shop e gestionale;
- nessuna formula sparsa nei componenti frontend;
- ricalcolo obbligatorio lato server.

Struttura consigliata:

- `catalog adapter`
  - legge `ServiceCatalog` e metadati pricing.

- `configuration validator`
  - valida opzioni ammesse e combinazioni impossibili.

- `pricing calculator`
  - applica regole base, scaglioni, copie, colore, fronte/retro, finiture, minimi, supplementi.

- `pricing snapshot builder`
  - produce dettaglio finale serializzabile nell'ordine.

Interfaccia concettuale:

```ts
quoteOrderItem({
  serviceCatalogId,
  configuration,
  quantity,
  files
}) => {
  unitPriceCents,
  lineTotalCents,
  breakdown,
  pricingVersion
}
```

Regole fondamentali:

- il client mostra preventivo live;
- il server ricalcola in `cart`, `checkout` e `order finalization`;
- `SalesOrderItem` salva `pricingSnapshotJson`;
- il prezzo non viene ricalcolato retroattivamente sugli ordini gia creati.

## 5.7 Gestione PDF/JPG e storage consigliato

Valutazione tecnica verificata il 2026-08-27 su documentazione ufficiale:

- Vercel Blob supporta client uploads;
- esiste anche private storage;
- per file sensibili conviene accesso privato con delivery via funzione autenticata;
- per file molto grandi o traffico elevato va valutato con attenzione il costo/throughput.

Raccomandazione pratica:

- per MVP: usare **Vercel Blob Private** se i file medi di stampa restano gestibili e si vuole minimizzare complessita infrastrutturale;
- usare upload diretto browser -> storage con token temporanei;
- servire i file solo tramite route autenticata/signed delivery;
- salvare nel DB `storageKey`, mai affidarsi a URL pubblici come identificatore unico del dominio.

Se in futuro i file diventano molto grandi o frequenti:

- valutare storage S3-compatible / R2 privato come evoluzione.

Formato file MVP:

- `application/pdf`
- `image/jpeg`

Policy minima:

- whitelist MIME e estensioni;
- limite dimensione configurabile;
- storage privato;
- scadenza automatica configurabile;
- join file <-> order item / job.

## 5.8 Struttura Order / OrderItem proposta

Per evitare ambiguita uso qui questi nomi:

- `SalesOrder` = ordine cliente / e-commerce;
- `Order` attuale = commessa operativa del gestionale nella fase di transizione.

Struttura `SalesOrder`:

- identifica l'acquisto del cliente;
- puo contenere piu prodotti;
- contiene stato pagamento, richiesta fattura, totali e snapshot fatturazione;
- non contiene logica produttiva dettagliata.

Struttura `SalesOrderItem`:

- una riga prodotto configurata;
- punta a `ServiceCatalog`;
- contiene configurazione e prezzo congelati;
- puo collegarsi a 0..N file;
- puo generare 0..N commesse.

## 5.9 Struttura Customer proposta

Modello consigliato:

- `Customer`
  - anagrafica business condivisa.

- `CustomerAccount`
  - credenziale di login e accesso shop.

- `CustomerAddress`
  - indirizzi multipli.

- `CustomerBillingProfile`
  - profili fatturazione riusabili.

Scelta importante:

- non fondere `User` staff e `CustomerAccount`.

## 5.10 Snapshot dati fatturazione

Ogni `SalesOrder` confermato deve salvare un record `SalesOrderBillingSnapshot`.

Regola:

- i dati usati al checkout restano congelati su quell'ordine;
- il profilo cliente resta modificabile per ordini futuri;
- l'ordine passato non cambia.

## 5.11 Struttura Payment proposta

Distinguere due livelli:

1. `PaymentRecord`
   - traccia il pagamento provider e il suo ciclo vita reale.

2. `Payment` attuale del gestionale
   - puo restare come ledger interno/manuale o vista derivata.

Non consiglio di allargare semplicemente l'attuale `Payment` ai webhook Stripe: e un modello nato per registrazioni interne, non per eventi esterni idempotenti.

## 5.12 Struttura Commessa proposta

Nel breve termine:

- riusare l'attuale tabella `Order` come commessa interna generata dal dominio shop;
- aggiungere collegamento esplicito tramite `SalesOrderJobLink`.

Nel medio termine, se si vuole massima chiarezza semantica:

- si potra rinominare o astrarre l'attuale `Order` come `Job`, ma non lo farei nella prima fase.

## 5.13 Regole di creazione automatica commessa

Regola concettuale:

```text
shouldCreateJob =
  serviceCatalog.createJobAutomatically
  OR salesOrder.invoiceRequested
```

Applicazione pratica:

- valutazione per singola riga ordine;
- un ordine puo generare piu commesse;
- la ragione della creazione va salvata in `SalesOrderJobLink.linkReason`.

## 5.14 Gestione commesse in attesa di pagamento

Flusso consigliato:

1. checkout crea `SalesOrder` in `PENDING_PAYMENT`;
2. se una riga richiede commessa anticipata:
   - creare `Order` gestionale collegato;
   - impostare stato operativo dedicato `IN_ATTESA_PAGAMENTO`;
   - bloccare avanzamenti di produzione finche il pagamento non e confermato;
3. webhook successo:
   - `SalesOrder -> PAID`
   - commesse collegate sbloccate verso produzione;
4. webhook fallimento:
   - `SalesOrder -> PAYMENT_FAILED`
   - commesse restano sospese o annullabili.

Questa parte richiede probabilmente una piccola estensione degli stati operativi esistenti.

## 5.15 Strategia notifiche

Non partire direttamente da email sparse.

Consiglio:

- introdurre un `DomainEvent` / outbox pattern;
- produrre eventi come:
  - `sales_order.created`
  - `sales_order.payment_succeeded`
  - `sales_order.payment_failed`
  - `file_asset.uploaded`
  - `job.created_from_shop`
- consumare questi eventi per:
  - notifiche interne gestionale;
  - email future;
  - push/browser notification future.

Questo evita doppie notifiche e facilita l'idempotenza.

## 5.16 Struttura route / API proposta

### Shop

- `GET /api/shop/catalog`
- `GET /api/shop/catalog/[slug]`
- `POST /api/shop/pricing/quote`
- `POST /api/shop/uploads/token`
- `POST /api/shop/cart/items`
- `PATCH /api/shop/cart/items/[id]`
- `POST /api/shop/checkout`
- `POST /api/shop/orders`
- `GET /api/shop/orders/[id]`
- `POST /api/shop/auth/register`
- `POST /api/shop/auth/login`
- `POST /api/shop/webhooks/stripe`

### Gestionale

- nuova sezione UI `web-orders`;
- route di dettaglio per ordine shop e commesse collegate;
- route protette per download file privati.

## 5.17 Struttura cartelle / moduli proposta

Se si resta nel repo attuale prima dello split:

```text
/app/(backoffice)
/app/(shop)
/app/api/shop
/app/api/backoffice

/lib/domain/catalog
/lib/domain/pricing
/lib/domain/commerce
/lib/domain/jobs
/lib/domain/files
/lib/domain/payments
/lib/domain/notifications
/lib/domain/customers
```

Obiettivo:

- separare subito i confini logici anche prima della separazione fisica in due app.

## 5.18 Roadmap di sviluppo consigliata

1. Step 0 - Audit
   - completato con questo documento.

2. Step 1 - Estrazione moduli condivisi
   - spezzare `lib/orders.ts` e `app/actions.ts` per sottodominio.

3. Step 2 - Migrazioni minime database
   - customer accounts, billing profiles, sales orders, file assets, pagamenti, job link.

4. Step 3 - Skeleton shop
   - route pubbliche, layout, catalogo base, auth cliente.

5. Step 4 - Configuratore stampa documenti MVP
   - upload PDF/JPG, opzioni base, pricing live server-backed.

6. Step 5 - Carrello e checkout
   - richiesta fattura, billing snapshot, ordine `PENDING_PAYMENT`.

7. Step 6 - Stripe
   - checkout session/payment intent, webhook idempotenti.

8. Step 7 - Integrazione gestionale
   - sezione ordini web, link commesse, download file privati.

9. Step 8 - Notifiche interne
   - event outbox e inbox gestionale.

10. Step 9 - Split app
   - passaggio a `apps/gestionale` + `apps/shop` quando i moduli condivisi sono maturi.

## 5.19 Principali rischi tecnici

Rischi principali:

1. Migrazione semantica di `Order`
   - il dominio attuale usa `Order` in molti punti come oggetto operativo.

2. Pricing troppo legato al form attuale
   - senza estrazione dedicata lo shop rischia di duplicare logica.

3. File privacy e costi storage
   - upload grandi + download autenticati vanno progettati bene.

4. Doppio sistema auth
   - staff e clienti devono restare isolati ma coerenti.

5. Webhook e idempotenza
   - se non modellati bene, possono generare doppie commesse o doppi stati.

6. Catalogo troppo flat per il futuro
   - se non si aggiungono metadati strutturati, ogni nuovo prodotto richiedera codice ad hoc.

7. Crescita di monoliti applicativi
   - se si aggiunge lo shop senza modularizzare, il debito tecnico aumentera rapidamente.

## 5.20 Coda breve pre-demo

Prima di spingere troppo sulla demo visuale va tenuto tracciato un intoppo tecnico reale emerso il 2026-08-27:

1. P0 - allineare sviluppo Next e typecheck locale
   - `npm run build` passa, ma `./node_modules/.bin/tsc --noEmit` puo fallire per riferimenti stale in `.next/types`;
   - in sviluppo sono emersi anche stati caldi incoerenti dopo alcuni hot reload, con route shop presenti nel build ma temporaneamente non risolte fino al riavvio pulito del dev server;
   - questo va risolto prima delle prossime iterazioni pesanti sullo shop, altrimenti rischiamo debug rumorosi e verifiche locali poco affidabili.

2. Azione consigliata
   - verificare la strategia di include in `tsconfig.json` per `.next/types` e `.next-dev/types`;
   - ripulire il flusso `dev-clean` / cache per evitare mismatch tra route generate e type artifacts;
   - chiudere il punto con una verifica chiara: `tsc --noEmit`, `npm run build`, refresh locale route shop senza restart manuale.

3. Ordine operativo
   - prima rendere forte la demo di `stampa-documenti`;
   - subito dopo chiudere questo blocco tecnico prima di checkout Stripe o nuovi configuratori complessi.

## 6. Raccomandazione finale sintetica

La base attuale del gestionale e abbastanza solida per diventare il core del nuovo ecosistema 28Print, ma non conviene innestarci lo shop semplicemente aggiungendo pagine pubbliche sopra il dominio attuale.

La scelta piu sana e:

- mantenere questo repository come punto di partenza;
- non creare un secondo catalogo;
- introdurre un nuovo dominio `SalesOrder` separato dall'attuale `Order`;
- riusare l'attuale `Order` come commessa interna nella fase di transizione;
- estrarre pricing, catalogo, file, pagamenti e notifiche in moduli condivisi;
- arrivare a due app separate nello stesso monorepo solo dopo aver stabilizzato i moduli comuni.

## 7. Riferimenti esterni verificati il 2026-08-27

- Next.js Multi Zones: [https://nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones)
- Vercel Blob Client Uploads: [https://vercel.com/docs/vercel-blob/client-upload](https://vercel.com/docs/vercel-blob/client-upload)
- Vercel Blob Private Storage: [https://vercel.com/docs/vercel-blob/private-storage](https://vercel.com/docs/vercel-blob/private-storage)
- Vercel Blob Security: [https://vercel.com/docs/vercel-blob/security](https://vercel.com/docs/vercel-blob/security)
- Stripe Payment Intents: [https://docs.stripe.com/payments/payment-intents](https://docs.stripe.com/payments/payment-intents)
- Stripe Webhooks: [https://docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
- Stripe Checkout Fulfillment: [https://docs.stripe.com/checkout/fulfillment](https://docs.stripe.com/checkout/fulfillment)
