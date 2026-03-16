nom# Fede Kart

Gestionale ordini desktop-first per negozio di stampa digitale.

## Cosa serve

- Node.js 20 LTS
- npm
- Git

Se usi `nvm`, il repository include il file `.nvmrc`:

```bash
nvm use
```

## 1. Scaricare il repository

Puoi farlo in due modi.

### Metodo A: da terminale

1. Vai su GitHub e copia l'URL del repository da `Code > HTTPS`.
2. Apri il terminale:
   - macOS: `Terminal`
   - Windows: `PowerShell`
3. Esegui:

```bash
git clone <url-del-repo-github>
cd <nome-cartella-repo>
```

### Metodo B: con GitHub Desktop

1. Apri GitHub Desktop.
2. Scegli `Clone repository`.
3. Seleziona il repository.
4. Apri la cartella clonata nel terminale.

## 2. Installare e preparare il progetto

Dalla cartella del progetto esegui:

```bash
npm install
npm run setup
```

Lo script `npm run setup` fa tutto il necessario per il primo avvio:

- crea `.env` da `.env.example` se manca
- genera un `AUTH_SECRET` locale
- genera Prisma Client
- crea o aggiorna il database SQLite
- carica i dati demo
- prepara la cartella upload locale

## 3. Avviare l'app in locale

Per lo sviluppo:

```bash
npm run dev
```

Poi apri:

[http://localhost:3000](http://localhost:3000)

Credenziali iniziali:

- Email: `admin@fede.local`
- Password: `admin123`

## 4. Test rapido dell'app

Dopo il login puoi verificare subito che tutto funzioni:

1. apri la dashboard
2. entra in `Ordini`
3. apri l'ordine demo creato dal seed
4. controlla `Clienti`, `Calendario`, `Produzione` e `Impostazioni`

Se queste pagine si aprono correttamente, il progetto e avviato bene.

## 5. Verificare test e build

### Eseguire i test

```bash
npm test
```

### Verificare la build locale

```bash
npm run build
npm run start
```

Poi apri di nuovo:

[http://localhost:3000](http://localhost:3000)

Questo serve a controllare che l'app non funzioni solo in sviluppo, ma anche come build locale.

## 6. Dove vengono salvati i dati locali

- Database SQLite: `prisma/dev.db`
- File caricati: `public/uploads/orders`
- Configurazione locale: `.env`

Questi file restano sul computer locale.

## 7. Comandi utili

- `npm run setup`: prepara il progetto su un clone pulito
- `npm run dev`: avvia l'app in sviluppo
- `npm test`: esegue i test
- `npm run build`: crea la build locale
- `npm run start`: avvia la build locale
- `npm run db:generate`: rigenera Prisma Client
- `npm run db:push`: aggiorna lo schema del database
- `npm run db:seed`: ricarica i dati demo

## 8. Se qualcosa non parte

Controlla in questo ordine:

1. `node -v` deve mostrare Node 20 o superiore
2. sei dentro la cartella del progetto
3. hai eseguito `npm install`
4. hai eseguito `npm run setup`
5. la porta `3000` non e gia occupata

Se serve, puoi rifare il bootstrap locale senza problemi:

```bash
npm run setup
```

## Stack

- Next.js 14
- TypeScript
- Prisma
- SQLite

## Note operative

- Il codice ordine visibile usa il formato `YYYY-MM-DD_titolo ordine`
- l'unicita del titolo e richiesta nello stesso giorno di creazione
- `order_code` non cambia anche se il titolo viene aggiornato dopo la creazione
