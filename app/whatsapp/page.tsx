import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { assertPrintAdmin } from "@/lib/print-jobs";
import { printEnabled } from "@/lib/print-runtime";
import { prisma } from "@/lib/prisma";
import { whatsappWebhookConfig } from "@/lib/whatsapp-runtime";
import styles from "./whatsapp.module.css";

export const dynamic = "force-dynamic";
export default async function WhatsAppInbox({ searchParams }: { searchParams: { chat?: string } }) {
  const session = await requireAuth();
  if (!printEnabled()) notFound();
  await assertPrintAdmin(session.userId);
  const messages = await prisma.whatsAppInboundMessage.findMany({ orderBy: { receivedAt: "desc" }, take: 100 });
  const chats = messages.filter((m, i) => messages.findIndex(other => other.sender === m.sender) === i);
  const selected = chats.find(m => m.sender === searchParams.chat) || chats[0];
  const configured = !!whatsappWebhookConfig();
  return <div className="stack">
    <header className={styles.heading}><div><span className={styles.kicker}>BANCO DIGITALE · PREVIEW</span><h1>WhatsApp</h1><p>Conversazioni e documenti, nello stesso posto.</p></div><Link className="button secondary" href="/settings/printing">Stampanti</Link></header>
    <div className={styles.connection}><span className={styles.dot} /><div><strong>{configured ? "Ricevitore di test configurato" : "Numero non collegato"}</strong><p>{configured ? "Il collegamento è verificato solo quando arriva un messaggio firmato. Download e stampa dei media non ancora attivi." : "L'app WhatsApp Business sul telefono continua a funzionare normalmente. Nessuna chat è stata importata."}</p></div></div>
    <section className={styles.inbox} aria-label="WhatsApp ricevuti">
      <aside className={styles.chats}><h2>Conversazioni</h2><span className={styles.caption}>Ultimi 100 messaggi ricevuti</span>{chats.length ? chats.map(chat => <Link key={chat.sender} className={`${styles.chat} ${selected?.sender === chat.sender ? styles.selected : ""}`} href={`/whatsapp?chat=${encodeURIComponent(chat.sender)}`}><strong>{chat.contactName}</strong><span>{chat.fileName || chat.text.slice(0, 70)}</span></Link>) : <p className={styles.emptyList}>Le chat compariranno qui dopo il collegamento ufficiale.</p>}</aside>
      <div className={styles.thread}>{selected ? <><header className={styles.threadHeader}><strong>{selected.contactName}</strong><span>+{selected.sender}</span></header><div className={styles.messages}>{messages.filter(m => m.sender === selected.sender).sort((a,b) => a.sentAt.getTime() - b.sentAt.getTime()).map(m => <article key={m.id} className={styles.message}>{m.text && <p>{m.text}</p>}{m.mediaId && <div className={styles.file}><span>DOCUMENTO RICEVUTO</span><strong>{m.fileName}</strong><small>{m.mimeType}</small><p>File non ancora acquisito. Serve il collegamento media e lo storage privato prima dell'anteprima o dell'invio.</p></div>}<time>{m.sentAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</time></article>)}</div></> : <div className={styles.empty}><div className={styles.mark}>↗</div><h2>Dal messaggio alla stampa.<br />Senza passare dal desktop.</h2><p>Qui vedrai i documenti ricevuti. Il flusso previsto è lo stesso degli allegati: anteprima, stampante e approvazione.</p><span className={styles.badge}>Collegamento Meta da completare</span><Link href="/orders">Prova intanto l'invio dagli allegati →</Link></div>}</div>
    </section>
    <details className="card card-pad"><summary>Collegamento e autorizzazioni</summary><p>Disponibile al momento agli amministratori attivi. La ricezione di un messaggio non autorizza mai una stampa.</p><p>Servono accesso Meta Business, verifica dell'idoneità del numero già usato nell'app e storage privato per i file. Non scollegare il numero dal telefono e non caricare documenti cliente nel Blob pubblico di test.</p><p>Il ricevitore predisposto verifica firma, account e numero di test, elimina le consegne duplicate e conserva solo messaggio e riferimenti al media. Non scarica file, non invia risposte e non avvia stampe. La protezione Vercel resta attiva: l'accesso del webhook Meta va configurato separatamente, senza rendergli disponibile l'intero gestionale.</p></details>
  </div>;
}
