UPDATE "Order"
SET "mainPhase" = 'IN_LAVORAZIONE'
WHERE "mainPhase" = 'CALENDARIZZATO';
