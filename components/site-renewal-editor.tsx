"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renewSiteAction } from "@/app/sites/actions";
import { getNextSiteRenewalDate, getSiteServicesToMonitor, siteServiceLabels } from "@/lib/managed-sites-domain";
import type { ManagedSiteRecord } from "@/lib/managed-sites-domain";
import { SiteDialog } from "@/components/site-dialog";

export function SiteRenewalEditor({ site, today, onClose, onSaved }: { site: ManagedSiteRecord; today: string; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const services = getSiteServicesToMonitor(site);
  const [serviceId, setServiceId] = useState(services[0].id);
  const service = services.find(entry => entry.id === serviceId)!;
  const [renewedOn, setRenewedOn] = useState(today);
  const [nextDueDate, setNextDueDate] = useState(getNextSiteRenewalDate(service, today));
  const [cost, setCost] = useState(service.costCents === null ? "" : (service.costCents / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <SiteDialog title={`Rinnovo · ${site.hostname}`} busy={busy} onClose={onClose}><form className="site-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await renewSiteAction({ siteId: site.id, siteVersion: site.version, serviceId: service.id, serviceVersion: service.version, renewedOn, nextDueDate, costCents: cost === "" ? null : Math.round(Number(cost) * 100), note });
      if (!result.ok) setError(result.error); else { onSaved(); router.refresh(); }
    } catch { setError("Rinnovo non registrato. Riprova."); } finally { setBusy(false); }
  }}>
    <div className="site-field"><label htmlFor="renew-service">Servizio</label><select id="renew-service" value={serviceId} onChange={event => { const next = services.find(entry => entry.id === event.target.value)!; setServiceId(next.id); setNextDueDate(getNextSiteRenewalDate(next, today)); setCost(next.costCents === null ? "" : (next.costCents / 100).toFixed(2)); }}>{services.map(entry => <option key={entry.id} value={entry.id}>{entry.kind === "HOSTING" && site.domainRenewalMode === "TOGETHER" ? "Hosting e dominio" : siteServiceLabels[entry.kind]}</option>)}</select></div>
    <div className="site-form-pair"><div className="site-field"><label htmlFor="renew-on">Rinnovato il</label><input id="renew-on" type="date" required max={today} value={renewedOn} onChange={event => setRenewedOn(event.target.value)} /></div><div className="site-field"><label htmlFor="renew-next">Prossima scadenza</label><input id="renew-next" type="date" required min={renewedOn} value={nextDueDate} onChange={event => setNextDueDate(event.target.value)} /></div></div>
    <div className="site-field"><label htmlFor="renew-cost">Costo rinnovo €</label><input id="renew-cost" type="number" min={0} step="0.01" value={cost} onChange={event => setCost(event.target.value)} /></div>
    <div className="site-field"><label htmlFor="renew-note">Nota</label><textarea id="renew-note" rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></div>
    {error ? <p className="site-error" role="alert">{error}</p> : null}
    <footer><button type="button" className="site-button quiet" disabled={busy} onClick={onClose}>Annulla</button><button type="submit" className="site-button primary" disabled={busy}>{busy ? "Registrazione…" : "Registra rinnovo"}</button></footer>
  </form></SiteDialog>;
}
