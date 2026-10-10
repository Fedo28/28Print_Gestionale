"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retrySiteEmailAction, saveSiteEmailSettingsAction, testSiteEmailAction } from "@/app/sites/actions";
import { SiteDialog } from "@/components/site-dialog";
import { confirmationSiteEmailText, defaultSiteEmailSettings, renderSiteReminder, SITE_EMAIL_ADDRESS, siteReminderEligibility } from "@/lib/site-email-domain";
import type { SiteEmailDashboard } from "@/lib/site-email";
import type { ManagedSiteRecord } from "@/lib/managed-sites-domain";
import { getSiteServicesToMonitor } from "@/lib/managed-sites-domain";
import { formatDateTime, formatDate } from "@/lib/format";

export function SiteEmailPreview({ site, settings, today, onClose }: { site: ManagedSiteRecord; settings: SiteEmailDashboard["settings"]; today: string; onClose: () => void }) {
  const services = getSiteServicesToMonitor(site);
  const [serviceId, setServiceId] = useState(services[0].id);
  const service = services.find(item => item.id === serviceId)!;
  const message = renderSiteReminder(site, service, settings);
  const eligibility = siteReminderEligibility(site, service, today, settings.leadDays);
  return <SiteDialog title={`Anteprima email · ${site.hostname}`} onClose={onClose}><div className="site-email-preview">
    {services.length > 1 ? <div className="site-field"><label htmlFor="preview-service">Servizio</label><select id="preview-service" value={serviceId} onChange={event => setServiceId(event.target.value)}>{services.map(item => <option key={item.id} value={item.id}>{item.kind === "HOSTING" ? "Hosting" : "Dominio"}</option>)}</select></div> : null}
    <dl><div><dt>Da</dt><dd>{SITE_EMAIL_ADDRESS}</dd></div><div><dt>Risposte a</dt><dd>{SITE_EMAIL_ADDRESS}</dd></div><div><dt>A</dt><dd>{message.to || "Email da completare"}</dd></div><div><dt>Oggetto</dt><dd>{message.subject}</dd></div></dl>
    <pre>{message.text}</pre><span className={`site-status ${eligibility.eligible ? "state-current" : "state-unconfirmed"}`}>{eligibility.reason}</span>
  </div></SiteDialog>;
}

export function SiteEmailPanel({ data, canConfigure, onClose }: { data: SiteEmailDashboard; canConfigure: boolean; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(data.settings);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tested, setTested] = useState(data.testMatches);
  const runtimeReady = data.runtime.canSend;
  const automaticActive = runtimeReady && data.settings.enabled && data.testMatches;
  const patch = (changes: Partial<typeof draft>) => { setDraft(current => ({ ...current, ...changes })); if (changes.subject !== undefined || changes.text !== undefined) setTested(false); };
  async function test() {
    setBusy(true); setError(""); setNotice("");
    try { const result = await testSiteEmailAction(recipient, draft); if (!result.ok) setError(result.error); else { setTested(true); setNotice(`Prova inviata a ${result.value.recipient}.`); router.refresh(); } }
    catch { setError("Prova non completata."); } finally { setBusy(false); }
  }
  return <SiteDialog title="Avvisi email" busy={busy} onClose={onClose}><form className="site-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const result = await saveSiteEmailSettingsAction(draft); if (!result.ok) setError(result.error); else { setDraft(result.value); setNotice("Impostazioni email salvate."); router.refresh(); } }
    catch { setError("Salvataggio non completato."); } finally { setBusy(false); }
  }}>
    <div className="site-email-summary"><span className={`site-status ${automaticActive ? "state-current" : "state-unconfirmed"}`}>{automaticActive ? "Invii automatici attivi" : "Invii automatici disattivati"}</span><strong>{SITE_EMAIL_ADDRESS}</strong><span>{data.runtime.local ? "Anteprima locale" : !data.runtime.providerConfigured ? "Servizio email da configurare" : !runtimeReady ? "Automatismo da configurare" : "Invio configurato"}</span></div>
    <div className="site-form-pair"><div className="site-field"><label htmlFor="email-lead">Preavviso (giorni)</label><input id="email-lead" type="number" min={1} max={90} value={draft.leadDays} disabled={!canConfigure || busy} onChange={event => patch({ leadDays: Number(event.target.value) })} /></div><div className="site-field"><label htmlFor="email-mode">Tipo di avviso</label><select id="email-mode" value={draft.mode} disabled={!canConfigure || busy} onChange={event => patch({ mode: event.target.value as typeof draft.mode, text: event.target.value === "CONFIRMATION" ? confirmationSiteEmailText : defaultSiteEmailSettings.text })}><option value="INFORMATION">Promemoria informativo</option><option value="CONFIRMATION">Richiesta di conferma</option></select></div></div>
    <div className="site-field"><label htmlFor="email-subject">Oggetto</label><input id="email-subject" maxLength={200} value={draft.subject} disabled={!canConfigure || busy} onChange={event => patch({ subject: event.target.value })} /></div>
    <div className="site-field"><label htmlFor="email-body">Testo della mail</label><textarea id="email-body" rows={9} maxLength={6000} value={draft.text} disabled={!canConfigure || busy} onChange={event => patch({ text: event.target.value })} /><span className="site-email-variables">{"{cliente} · {sito} · {servizio} · {scadenza}"}</span></div>
    {canConfigure ? <fieldset><legend>Prova di invio</legend><div className="site-field"><label htmlFor="email-test">Email per la prova</label><input id="email-test" type="email" value={recipient} disabled={busy} onChange={event => setRecipient(event.target.value)} /></div><button type="button" className="site-button" disabled={busy || !runtimeReady || !recipient.trim()} onClick={test}>Invia prova</button><span className="site-muted">{tested ? "Modello verificato con un invio di prova" : "Prova di invio da completare"}</span></fieldset> : null}
    <label className="site-email-toggle"><input type="checkbox" checked={draft.enabled} disabled={!canConfigure || busy || (!draft.enabled && (!runtimeReady || !tested))} onChange={event => patch({ enabled: event.target.checked })} />Invii automatici</label>
    {error ? <p className="site-error" role="alert">{error}</p> : null}{notice ? <p className="site-notice" role="status">{notice}</p> : null}
    <footer><button type="button" className="site-button quiet" onClick={onClose} disabled={busy}>Chiudi</button>{canConfigure ? <button type="submit" className="site-button primary" disabled={busy}>Salva impostazioni</button> : null}</footer>
    <section className="site-email-history"><h3>Storico avvisi</h3>{data.history.length ? data.history.map(entry => <article key={entry.id}><header><strong>{entry.hostname}</strong><span className="site-status">{{ SENDING: "In elaborazione", SENT: "Inviata", FAILED: "Invio fallito", UNKNOWN: "Esito da verificare", CANCELLED: "Annullata" }[entry.status]}</span></header><span>{entry.recipient} · Scadenza {formatDate(`${entry.dueDate}T12:00:00Z`)}</span><small>{formatDateTime(entry.sentAt || entry.createdAt)}</small>{entry.error ? <p>{entry.error}</p> : null}{canConfigure && entry.status === "FAILED" ? <button type="button" className="site-button" disabled={busy || !automaticActive} onClick={async () => { setBusy(true); setError(""); try { const result = await retrySiteEmailAction(entry.id); if (!result.ok) setError(result.error); else { setNotice(result.value === "sent" ? "Avviso inviato." : "Tentativo registrato nello storico."); router.refresh(); } } catch { setError("Tentativo non completato."); } finally { setBusy(false); } }}>Riprova</button> : null}</article>) : <span className="site-muted">Nessun avviso inviato</span>}</section>
  </form></SiteDialog>;
}
