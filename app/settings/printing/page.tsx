import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { assertPrintAdmin, printSourceLabels, printStatusLabels } from "@/lib/print-jobs";
import { printEnabled } from "@/lib/print-runtime";
import { prisma } from "@/lib/prisma";
import { revokeBridgeAction } from "@/app/orders/[id]/fiery/actions";
import { PrintLiveRefresh } from "@/components/print-live-refresh";
import { printConnectionLabel } from "@/lib/print-connection";
import { PrintConfiguration } from "@/components/print-configuration";

export const dynamic = "force-dynamic";
export default async function PrintingSettings({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const session = await requireAuth();
  if (!printEnabled()) return <p>Prototipo Fiery disattivato.</p>;
  await assertPrintAdmin(session.userId);
  const bridges = await prisma.printBridge.findMany({ select: { id: true, name: true, enabled: true, lastSeenAt: true,
    destinations: { select: { id: true, key: true, name: true, printerName: true, enabled: true } } } });
  const jobs = await prisma.printJob.findMany({ take: 50, orderBy: { approvedAt: "desc" }, select: { id: true, orderId: true, orderCode: true, sourceType: true, status: true, fileName: true } });
  const [printers, profiles, destinations] = await Promise.all([
    prisma.printPrinter.findMany({ orderBy: { name: "asc" } }),
    prisma.printProfile.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.printDestination.findMany({ orderBy: { createdAt: "asc" }, include: { printer: true, profile: true, bridge: { select: { id: true, name: true, enabled: true } } } })
  ]);
  return <div className="stack"><Link href="/settings">Impostazioni</Link><h1>Stampanti, profili e Bridge · ambiente di prova</h1>
    <PrintLiveRefresh />
    <div className="button-row"><Link className="button secondary" href="/orders">Invia dagli allegati dell'ordine</Link><Link className="button secondary" href="/whatsapp">WhatsApp ricevuti</Link></div>
    {searchParams.saved && <p role="status">Configurazione salvata. Nessun documento inviato.</p>}
    {searchParams.error && <p role="alert">{searchParams.error.slice(0, 400)}</p>}
    <section className="card card-pad stack">
      <h2>Uso quotidiano</h2>
      <p>Il Bridge configurato parte al login dell’utente Windows. Il collegamento desktop “28PRINT Bridge” apre il pannello di controllo: chiuderlo non ferma il programma.</p>
      <p>Il PC deve restare acceso e senza sospensione, con Fiery Hot Folders attivo. Il contatto recente conferma la comunicazione con il gestionale, non la disponibilità della stampante.</p>
      <p>Approva i PDF dall’ordine. Il profilo di prova consegna una copia A4, in scala di grigi e solo fronte, alla coda in attesa: non avvia la stampa fisica.</p>
    </section>
    <PrintConfiguration printers={printers} profiles={profiles} destinations={destinations} bridges={bridges} />
    <p>Registrazione e rotazione delle credenziali si effettuano dalla procedura amministrativa. I percorsi Windows restano nella configurazione locale del Bridge.</p>
    {bridges.map(bridge => <section key={bridge.id} className="card card-pad stack"><h2>{bridge.name}</h2>
      <p><strong>{printConnectionLabel(bridge.enabled, bridge.lastSeenAt)}</strong> · Ultimo contatto: {bridge.lastSeenAt?.toLocaleString("it-IT", { timeZone: "Europe/Rome" }) || "mai"}</p>
      {bridge.destinations.map(d => <p key={d.id}>{d.printerName} · {d.name} · {d.key} · {d.enabled ? "attiva" : "disattivata"}</p>)}
      {bridge.enabled && <form action={revokeBridgeAction}><input type="hidden" name="bridgeId" value={bridge.id} /><button type="submit">Revoca accesso del Bridge</button></form>}
      <p>La revoca blocca le nuove richieste. Un deposito già autorizzato potrebbe essere in corso: arrestare il programma sul PC per intervenire su un esito incerto.</p>
    </section>)}
    <h2>Ultimi lavori</h2>{jobs.map(job => <p key={job.id}>{printSourceLabels[job.sourceType]} · {job.orderId ? <Link href={`/orders/${job.orderId}/fiery`}>{job.orderCode} · {job.fileName}</Link> : <span>{job.orderCode} · {job.fileName}</span>} · {printStatusLabels[job.status]}</p>)}
  </div>;
}
