28PRINT Bridge 0.2 - ambiente di prova V1

INSTALLAZIONE GIA CONFIGURATA: leggi AGGIORNAMENTO-DESKTOP.txt.
Non rifare l'installazione e non reinserire chiavi. L'aggiornamento aggiunge
il pannello desktop e l'avvio silenzioso preservando configurazione e dati.

PRIMA INSTALLAZIONE:

1. Estrarre il contenuto ZIP in C:\28PRINT-Bridge.
   Non sovrascrivere un'installazione esistente: configurazione, credenziali
   e registro SQLite devono essere preservati.
2. Aprire PowerShell nella cartella ed eseguire:
   node --version
   npm.cmd ci
   npm.cmd run typecheck
   npm.cmd test
3. Seguire README.md, sezioni 3-6. Servono ancora l'URL HTTPS Preview
   verificato e le due credenziali separate, trasferite in modo riservato.
   Non mettere segreti in config.json, chat o cartelle condivise.
4. config.example.json contiene il percorso comunicato dall'operatore:
   C:\Users\UTENTE\Desktop\Automazione 650\28PRINT_TEST_A4_BN
   Il volume C: e' stato confermato NTFS dall'operatore.
   verifiedHoldOneCopy resta false: verificare davvero una copia e ATTESA
   (G100 attesa) in Fiery prima di abilitare il Bridge.
5. Il PDF in test-document si carica come allegato nell'ordine DI PROVA.
   Si puo' caricare dal Mac o da un altro dispositivo: non occorre copiarlo
   a mano nella Hot Folder. Sara' il Bridge a recuperarlo dopo approvazione.
6. Non avviare il servizio automatico prima del collaudo assistito.
   Nessuna operazione di questo pacchetto installa driver o cambia Fiery.

Il pacchetto non contiene credenziali, node_modules, file clienti o config.json.
SHA256SUMS.txt contiene le impronte dei file distribuiti.
Consegnato alla Hot Folder NON significa Stampato.
