"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { approveAttachmentQuick, reviewAttachmentQuick } from "@/app/orders/[id]/fiery/quick-actions";
import styles from "./print-quick.module.css";
import { PrintPdfPreview } from "./print-pdf-preview";

type Review = Extract<Awaited<ReturnType<typeof reviewAttachmentQuick>>, { ok: true }>["review"];
const repeatable = new Set(["DELIVERED", "PRINTED", "ERROR", "CANCELLED"]);
export function PrintAttachmentButton({ orderId, attachmentId, status, statusLabel, printerName, admin }: {
  orderId: string; attachmentId: string; status?: string; statusLabel?: string; printerName?: string; admin: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileId, setProfileId] = useState(""), [destinationId, setDestinationId] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!notice && !["APPROVED", "PREPARING", "SENDING"].includes(status || "")) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [status, notice, router]);
  useEffect(() => { if (status) setNotice(""); }, [status]);
  async function open() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setReview(undefined); setReason("");
    dialog.current?.showModal();
    try {
      const result = await reviewAttachmentQuick(orderId, attachmentId);
      if (!result.ok) { setError(result.error); return; }
      setReview(result.review);
      const firstProfile = result.review.options[0]?.profileId || "";
      const eligible = result.review.options.filter(o => o.profileId === firstProfile);
      setProfileId(firstProfile); setDestinationId((eligible.find(o => o.recommended) || eligible[0])?.id || "");
    } catch { setError("Collegamento non disponibile. Chiudi e riprova."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const selected = review?.options.find(o => o.id === destinationId);
  const prior = review?.latest;
  const blocked = !!prior && !repeatable.has(prior.status);
  async function approve(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || !review || blocked || !selected) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await approveAttachmentQuick({ orderId, attachmentId, destinationId, sha256: review.sha256,
        reprintOfId: prior?.id, reason, confirmed: true });
      if (!result.ok) { setError(result.error); return; }
      setNotice("Invio autorizzato · aggiornamento stato…"); dialog.current?.close(); router.refresh();
    } catch { setError("Risposta non ricevuta. Puoi riprovare qui: la stessa autorizzazione non crea due lavori. Non aprire un nuovo invio."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className={styles.attachmentAction}>
    <div aria-live="polite"><span className={styles.status}>{notice || statusLabel || "Da inviare"}</span>{printerName && <span className={styles.muted}> · {printerName}</span>}</div>
    {admin && (!status || repeatable.has(status)) && <button type="button" className="button secondary" onClick={open} disabled={busy}>{status ? "Invia di nuovo…" : "Invia a Fiery"}</button>}
    {status === "NEEDS_REVIEW" && <a href={`/orders/${orderId}/fiery`}>Verifica esito prima di reinviare</a>}
    <dialog ref={dialog} className={styles.dialog} onCancel={event => { if (busy) event.preventDefault(); }}>
      <header className={styles.header}><div><span className={styles.eyebrow}>INVIO DOCUMENTO</span><h2>{prior ? "Nuovo invio a Fiery" : "Invia a Fiery"}</h2></div><button type="button" onClick={() => dialog.current?.close()} disabled={busy} aria-label="Chiudi anteprima">✕</button></header>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!review && busy && <p role="status" className={styles.loading}>Verifico il PDF e le stampanti…</p>}
      {review && <form onSubmit={approve} className={styles.body}>
        <section className={styles.preview}><PrintPdfPreview url={review.url} fileName={review.fileName} /><a href={review.url} target="_blank" rel="noreferrer">Apri PDF in una scheda ↗</a></section>
        <section className={styles.controls}>
          <div><h3>{review.fileName}</h3><p className={styles.muted}>{review.pageCount} {review.pageCount === 1 ? "pagina" : "pagine"} · PDF verificato</p></div>
          <label>Come lo vuoi?<select aria-label="Profilo di stampa" value={profileId} disabled={busy} onChange={event => {
            const id = event.target.value; setProfileId(id); const opts = review.options.filter(o => o.profileId === id);
            setDestinationId((opts.find(o => o.recommended) || opts[0])?.id || "");
          }}>{review.options.filter((o, i, all) => all.findIndex(p => p.profileId === o.profileId) === i).map(o => <option key={o.profileId} value={o.profileId}>{o.profileName}</option>)}</select></label>
          <label>Stampante<select aria-label="Stampante" value={destinationId} required disabled={busy} onChange={event => setDestinationId(event.target.value)}>{review.options.filter(o => o.profileId === profileId).map(o => <option key={o.id} value={o.id}>{o.printerName}{o.recommended ? " · consigliata" : ""}</option>)}</select></label>
          <p className={styles.summary}>{selected?.description || "Nessuna destinazione disponibile."}</p>
          {selected && !selected.online && <p role="status" className={styles.warning}>PC non collegato di recente: l'invio resterà in coda fino alla riconnessione.</p>}
          {prior && !blocked && <label>Perché lo invii di nuovo?<select required value={reason} disabled={busy} onChange={e => setReason(e.target.value)}><option value="">Scegli il motivo</option><option>Nuova copia richiesta dal cliente</option><option>Invio a una stampante differente</option><option>Collaudo autorizzato della destinazione</option></select></label>}
          {blocked ? <p role="alert">Questo documento ha già un invio in corso o da verificare. <a href={`/orders/${orderId}/fiery`}>Apri il dettaglio</a></p> : <><p className={styles.muted}>Controlla l'anteprima. Premendo il pulsante approvi queste impostazioni. Il documento arriva <strong>in attesa su Fiery</strong>: non avvia la stampa fisica.</p><button className="button primary" type="submit" disabled={busy || !selected || (!!prior && !reason)}>{busy ? "Autorizzazione…" : prior ? "Approva nuovo invio" : "Approva e invia"}</button></>}
        </section>
      </form>}
    </dialog>
  </div>;
}
