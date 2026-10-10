# Fede Kart

Gestionale ordini desktop-first per negozio di stampa digitale, con supporto locale e beta online su Vercel.

## Stack

- Next.js 14
- TypeScript
- Prisma
- PostgreSQL
- Vercel Blob

## Variabili ambiente

Copiando `.env.example` in `.env` trovi le chiavi da compilare:

- `DATABASE_URL`: connessione PostgreSQL
- `AUTH_SECRET`: chiave sessione
- `BLOB_READ_WRITE_TOKEN`: token Vercel Blob
- `ADMIN_NAME`: nome admin bootstrap produzione
- `ADMIN_EMAIL`: email admin bootstrap produzione
- `ADMIN_PASSWORD`: password admin bootstrap produzione
- `LOCAL_DEMO_DATA`: se `true`, il setup locale carica anche i dati demo

Per il deploy Vercel, `BLOB_READ_WRITE_TOKEN` e obbligatorio se vuoi caricare allegati online.

## Setup locale

Prerequisiti:

- Node.js 24 (come configurato in `.nvmrc` e `package.json`)
- npm
- un database PostgreSQL gia disponibile

Passi:

```bash
npm install
npm run setup
```

Lo script `npm run setup`:

- crea `.env` da `.env.example` se manca
- genera un `AUTH_SECRET` locale se assente
- prepara la cartella upload locale
- genera Prisma Client
- applica le migrazioni Prisma al database configurato
- carica i dati demo solo se `LOCAL_DEMO_DATA="true"`

Se vuoi anche i dati demo locali:

```bash
LOCAL_DEMO_DATA="true"
npm run setup
```

Credenziali demo locali:

- Email: `admin@fede.local`
- Password: `admin123`

## Comandi utili

### Anteprima locale dell'area personale

Su macOS Apple Silicon, `npm run dev:preview` avvia il gestionale su `http://localhost:3001` con PostgreSQL locale. Alla prima esecuzione copia i dati del database configurato in una transazione di sola lettura e applica le migrazioni alla copia. Le prove successive restano nella copia locale, conservata in `.local-preview` e esclusa da Git. Il database online non viene aggiornato da questo comando.

L'anteprima conserva i profili e le credenziali già presenti. I binari PostgreSQL vengono preparati da npm in una cartella temporanea; il database ascolta solo su `127.0.0.1`, con password locale. La copia non si sincronizza automaticamente con il database di origine. Nell'anteprima email, push, Stripe e scritture su Vercel Blob sono disattivati; gli eventuali upload usano lo storage locale.

`npm run test:workspace` verifica privacy dei post-it, collaborazione e modifiche simultanee sul database locale dell'anteprima. Il normale `npm test` esegue i test unitari e salta questi test di integrazione quando manca la configurazione locale.

L'area personale include incarichi facoltativi, commissioni libere, una vista della squadra e post-it privati per profilo. Le date degli incarichi sono indipendenti dalle consegne degli ordini; gli orari si riferiscono a Europe/Rome. Il collegamento Google Calendar è previsto come sviluppo successivo.

La pagina `/sites` gestisce hosting e rinnovi dei siti. La migrazione `20261009122000_add_managed_sites` inserisce i 18 domini e le date giorno/mese forniti, senza presumere clienti, anni o scadenze dei domini. Le associazioni suggerite sono modificabili; ogni sito può avere dominio e hosting sullo stesso rinnovo o su rinnovi separati. Gli anni mancanti compaiono come "Anno da confermare" e sono esclusi dai conteggi di scaduti e scadenze certe entro 30 giorni. La lista resta ordinata per la prossima ricorrenza annuale per queste date parziali. Registrare un rinnovo aggiorna la scadenza e salva storico, costo e autore, con protezione da aggiornamenti simultanei. L'archivio è recuperabile. I futuri accessi e codici di licenza richiedono campi protetti dedicati.

`npm run test:sites` verifica creazione, associazione, rinnovi e archivio sul solo database locale dell'anteprima. Questi test di integrazione vengono saltati dal normale `npm test` quando manca la configurazione locale.

Gli avvisi email dei siti usano il mittente e l'indirizzo di risposta `info@28print.it`, con modello informativo e preavviso iniziale di 30 giorni. Dal pulsante "Avvisi email" un amministratore può modificare il testo, mandare una prova e attivare gli invii; le anteprime dei singoli siti restano disponibili senza inviare mail. L'abilitazione per sito è inizialmente disattivata. Serve un cliente associato, una email valida e la scadenza completa di anno. È possibile specificare un recapito per i rinnovi diverso dall'email del cliente. I costi del provider e le note interne non vengono inseriti nel modello.

Per l'invio in produzione: verificare il dominio `28print.it` su Resend, configurare `RESEND_API_KEY`, `CRON_SECRET` (almeno 16 caratteri casuali) e `SITE_RENEWAL_EMAILS_ENABLED=true` su Vercel; pubblicare il progetto, inviare una prova a un indirizzo scelto e poi attivare gli avvisi dal gestionale. Una prova corrispondente al modello e alla chiave attuali è obbligatoria prima dell'attivazione. Il cron protetto `/api/cron/site-renewal-reminders` è programmato ogni giorno alle 07:00 UTC. La finestra considera giorni di calendario in Europe/Rome; un avviso non ancora inviato viene recuperato se la prima esecuzione avviene già dentro il periodo di preavviso. Le scadenze passate o incomplete e i siti archiviati sono esclusi. Dominio e hosting sullo stesso rinnovo producono un unico avviso. Il registro impone una sola notifica per servizio e scadenza, con chiavi di idempotenza anche sul provider. I rifiuti definitivi sono ritentabili dall'amministratore; gli esiti incerti restano da verificare per evitare duplicazioni. I controlli elaborano al massimo 20 invii per esecuzione con ritmo limitato e durata contenuta.

La copia locale non invia email neppure se sono presenti chiavi o impostazioni copiate dalla produzione. `npm run test:site-email` verifica l'automatismo sul database locale con un trasporto simulato, senza messaggi reali.

La lista “Lavori e commissioni” è sempre visibile sotto l'agenda personale, con ricerca, filtri e scorrimento interno. Il + prende in carico un ordine aperto senza assegnare una data, oppure aggiunge il profilo ai collaboratori di un incarico già seguito. Le collaborazioni mantengono l'eventuale programmazione condivisa. “Organizza” e “Nuova commissione” conservano le opzioni complete di giorno, orario e collaboratori.

- `npm run dev`: sviluppo locale
- `npm run build`: build locale
- `npm run start`: start build locale
- `npm test`: test
- `npm run db:generate`: rigenera Prisma Client
- `npm run db:migrate:dev`: crea/applica migrazioni in sviluppo
- `npm run db:migrate:deploy`: applica migrazioni esistenti
- `npm run db:seed:local`: inserisce dati demo locali
- `npm run db:bootstrap:prod`: crea/aggiorna admin e impostazioni minime produzione
- `npm run deploy:check-env`: verifica le env minime per il deploy Vercel
- `npm run vercel-build`: build per Vercel con migrazioni e bootstrap

## Deploy su Vercel

Configura in Vercel le env:

- `DATABASE_URL`
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Valori consigliati:

- `DATABASE_URL`: stringa PostgreSQL reale, non il placeholder di `.env.example`
- `AUTH_SECRET`: almeno 32 caratteri
- `ADMIN_PASSWORD`: almeno 8 caratteri

Il repository include [`vercel.json`](/Users/federicopolichetti/Desktop/Gestionale V_GitHub/vercel.json) con build command:

```bash
npm run vercel-build
```

Durante il deploy:

1. viene validata la configurazione ambiente richiesta per la beta online
2. Prisma applica le migrazioni con `prisma migrate deploy`
3. viene eseguito il bootstrap produzione
4. Next costruisce l'app

Passi rapidi per andare online:

1. importa il repository su Vercel
2. collega un database PostgreSQL
3. crea uno store Vercel Blob collegato al progetto
4. inserisci tutte le env richieste in Project Settings > Environment Variables
5. lancia il deploy
6. usa l'URL generato da Vercel per la demo

## Note operative

- I dati non sono piu basati su `prisma/dev.db`
- Gli allegati online usano Vercel Blob con upload diretto dal browser, cosi evitano il limite body di 4.5 MB delle Vercel Functions
- Gli allegati locali restano su `public/uploads/orders`
- Il bootstrap produzione e idempotente: puo essere rieseguito senza duplicare l'admin
