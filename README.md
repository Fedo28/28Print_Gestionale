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

## Setup locale

Prerequisiti:

- Node.js 20+
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

- `npm run dev`: sviluppo locale
- `npm run build`: build locale
- `npm run start`: start build locale
- `npm test`: test
- `npm run db:generate`: rigenera Prisma Client
- `npm run db:migrate:dev`: crea/applica migrazioni in sviluppo
- `npm run db:migrate:deploy`: applica migrazioni esistenti
- `npm run db:seed:local`: inserisce dati demo locali
- `npm run db:bootstrap:prod`: crea/aggiorna admin e impostazioni minime produzione
- `npm run vercel-build`: build per Vercel con migrazioni e bootstrap

## Deploy su Vercel

Configura in Vercel le env:

- `DATABASE_URL`
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Il repository include [`vercel.json`](/Users/federicopolichetti/Desktop/28Print/vercel.json) con build command:

```bash
npm run vercel-build
```

Durante il deploy:

1. Prisma applica le migrazioni con `prisma migrate deploy`
2. viene eseguito il bootstrap produzione
3. Next costruisce l'app

## Note operative

- I dati non sono piu basati su `prisma/dev.db`
- Gli allegati online usano Vercel Blob
- Gli allegati locali restano su `public/uploads/orders`
- Il bootstrap produzione e idempotente: puo essere rieseguito senza duplicare l'admin
