import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { printEnabled } from "@/lib/print-runtime";
import { printStatusLabels, reviewPrintAttachment } from "@/lib/print-jobs";
import { approvePrintAction, managePrintAction } from "./actions";
import { PrintLiveRefresh } from "@/components/print-live-refresh";
import { destinationUnavailable, profileDescription, recommendDestination } from "@/lib/print-profiles";
import { PrintDestinationPicker } from "@/components/print-destination-picker";

export const dynamic = "force-dynamic";
export default async function FieryOrderPage({ params, searchParams }: { params: { id: string }; searchParams: { attachment?: string; reprint?: string } }) {
  const session = await requireAuth();
  if (!printEnabled()) return <div className="card card-pad">Prototipo Fiery disattivato. Disponibile solo nell'ambiente di test.</div>;
  const actor = await prisma.user.findUnique({ where: { id: session.userId }, select: { active: true, role: true } });
  const admin = actor?.active && actor.role === "ADMIN";
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { attachments: true } });
  if (!order) notFound();
  const [configuredDestinations, jobs] = await Promise.all([
    prisma.printDestination.findMany({ orderBy: { name: "asc" }, include: { printer: true, profile: true, bridge: { select: { enabled: true } } } }),
    prisma.printJob.findMany({ where: { orderId: order.id }, orderBy: { approvedAt: "desc" }, take: 50, include: { destination: true, events: { orderBy: { createdAt: "asc" } } } })
  ]);
  const destinations = configuredDestinations.filter(d => !destinationUnavailable(d));
  const options = destinations.map(d => ({ id: d.id, name: d.name, printerName: d.printer!.name,
    profileId: d.profile!.id, profileName: d.profile!.name, description: profileDescription(d.profile!),
    recommended: recommendDestination(destinations, d.profile!.colorMode, d.profile!.id)?.id === d.id }));
  let review: Awaited<ReturnType<typeof reviewPrintAttachment>> | undefined, reviewError = "";
  if (searchParams.attachment && admin) {
    try { review = await reviewPrintAttachment(session.userId, order.id, searchParams.attachment); }
    catch (error) { reviewError = error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Impossibile verificare il PDF."; }
  }
  return <div className="stack">
    <PrintLiveRefresh />
    <div className="button-row"><Link href={`/orders/${order.id}`}>Torna all'ordine</Link>{admin && <Link href="/settings/printing">Bridge e destinazioni</Link>}</div>
    <h1>Invio documenti a Fiery</h1><p>{order.orderCode} · {order.title}</p>
    <p>Profilo di prova: A4, scala di grigi, solo fronte, una copia, attesa. Consegnare il file non significa averlo stampato.</p>
    {!destinations.length && <p role="alert">Nessuna destinazione abilitata: completare la configurazione del Bridge.</p>}
    <section className="card card-pad stack"><h2>PDF da verificare</h2>
      {order.attachments.filter(file => file.fileName.toLowerCase().endsWith(".pdf")).map(file => <div className="button-row" key={file.id}>
        <a href={file.filePath} target="_blank" rel="noreferrer">{file.fileName}</a>
        {admin && !order.isQuote && <Link className="button secondary" href={`/orders/${order.id}/fiery?attachment=${file.id}`}>Verifica e approva</Link>}
        {!jobs.some(job => job.attachmentId === file.id) && <span>In attesa di approvazione</span>}
      </div>)}
    </section>
    {reviewError && <p role="alert">{reviewError}</p>}
    {review && <section className="card card-pad stack"><h2>{searchParams.reprint ? "Autorizza un nuovo invio" : "Approva questa revisione"}</h2>
      <p>{review.attachment.fileName} · {review.pageCount} pagine A4 · {review.fileSize} byte</p>
      <p style={{ overflowWrap: "anywhere" }}>Impronta del documento: {review.sha256}</p>
      <form action={approvePrintAction} className="stack">
        <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="attachmentId" value={review.attachment.id} />
        <input type="hidden" name="sha256" value={review.sha256} /><input type="hidden" name="reprintOfId" value={searchParams.reprint || ""} />
        <PrintDestinationPicker options={options} />
        {searchParams.reprint && <label>Motivo del nuovo invio<input name="reason" minLength={8} maxLength={500} required /></label>}
        <label><input type="checkbox" name="confirmed" required /> Ho aperto e verificato il PDF. Confermo A4, scala di grigi, solo fronte, una copia e destinazione in attesa.</label>
        <button type="submit" className="primary" disabled={!destinations.length}>Approva invio a Fiery</button>
      </form>
    </section>}
    <section className="stack"><h2>Registro dei lavori</h2>
      {jobs.length === 0 && <p>Nessun documento ancora approvato.</p>}
      {jobs.map(job => <article key={job.id} className="card card-pad stack">
        <h3>{job.fileName}</h3><strong>{printStatusLabels[job.status]}</strong>
        <p>{job.destination.printerName} · {job.destination.name}</p>
        <p>Approvato da {job.approvedByName} il {job.approvedAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</p>
        <p style={{ overflowWrap: "anywhere" }}>Nome in Fiery: 28PRINT-{job.id}.pdf</p>
        {job.lastError && <p role="alert">{job.lastError}</p>}
        {admin && <form action={managePrintAction} className="stack">
          <input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="version" value={job.version} />
          {["APPROVED", "PREPARING", "SENDING", "DELIVERED", "NEEDS_REVIEW"].includes(job.status) && <label>Nota della verifica<input name="reason" minLength={8} maxLength={500} required /></label>}
          {job.status === "NEEDS_REVIEW" && <label><input type="checkbox" name="bridgeStopped" required /> Ho arrestato il Bridge e verificato coda, archivio e registro Fiery usando questo identificativo.</label>}
          <div className="button-row">
            {["APPROVED", "PREPARING"].includes(job.status) && <button name="operation" value="cancel">Annulla prima dell'invio</button>}
            {job.status === "SENDING" && <button name="operation" value="review">Segnala esito da verificare</button>}
            {job.status === "DELIVERED" && <button name="operation" value="printed">Confermo stampa fisica completata</button>}
            {job.status === "NEEDS_REVIEW" && <><button name="operation" value="received">Confermo ricezione in Fiery</button><button name="operation" value="not-received">Confermo mancata ricezione</button></>}
          </div>
        </form>}
        {admin && ["DELIVERED", "PRINTED", "ERROR", "CANCELLED"].includes(job.status) && !jobs.some(child => child.reprintOfId === job.id) && <Link href={`/orders/${order.id}/fiery?attachment=${job.attachmentId}&reprint=${job.id}`}>Verifica il PDF e autorizza un nuovo invio</Link>}
        <details><summary>Storico</summary>{job.events.map(e => <p key={e.id}>{e.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · {e.detail}</p>)}</details>
      </article>)}
    </section>
  </div>;
}
