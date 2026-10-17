export function printConnectionLabel(enabled: boolean, lastSeenAt: Date | null, now = Date.now()) {
  if (!enabled) return "Accesso revocato";
  if (!lastSeenAt) return "In attesa del primo collegamento";
  const age = now - lastSeenAt.getTime();
  if (age >= 0 && age <= 90000) return "Collegato di recente";
  return "Contatto non recente: verificare PC, rete e Bridge";
}
