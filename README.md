# Fede Kart

Gestionale ordini desktop-first per negozio di stampa digitale.

## Stack

- Next.js 14
- TypeScript
- Prisma
- SQLite

## Avvio locale

1. Installare Node.js 20+.
2. Copiare `.env.example` in `.env`.
3. Eseguire `npm install`.
4. Eseguire `npm run db:generate`.
5. Eseguire `npm run db:push`.
6. Facoltativo: `npm run db:seed`.
7. Avviare con `npm run dev`.

## Accesso iniziale

- Email: `admin@fede.local`
- Password: `admin123`

## Funzioni incluse

- Dashboard ordini con indicatori di ritardo, blocchi e incassi.
- Gestione clienti.
- Creazione ordini con righe catalogo o personalizzate.
- Calendario consegne.
- Vista produzione.
- Allegati ordine con upload locale.
- Pagamenti con acconto e saldo.
- Tracciamento fatturazione interno.
- Link WhatsApp precompilato quando l'ordine viene marcato pronto.
- Login locale con ruolo `admin`.

## Note operative

- Il codice ordine visibile usa il formato `YYYY-MM-DD_titolo ordine`.
- L'unicita del titolo e richiesta nello stesso giorno di creazione.
- `order_code` non cambia anche se il titolo viene aggiornato dopo la creazione.
