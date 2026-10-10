"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveSiteAction, associateSiteAction } from "@/app/sites/actions";
import { domainRenewalLabels, filterManagedSites, formatSiteDueDate, getSiteRenewalState, getSiteServicesToMonitor, siteServiceLabels, suggestSiteCustomers } from "@/lib/managed-sites-domain";
import type { ManagedSiteRecord, SiteCustomer, SiteFilter, SiteServiceRecord } from "@/lib/managed-sites-domain";
import { formatDate, formatCurrency } from "@/lib/format";
import { SiteDialog } from "@/components/site-dialog";
import { SiteEditor } from "@/components/site-editor";
import { SiteRenewalEditor } from "@/components/site-renewal-editor";
import { WorkspaceLiveRefresh } from "@/components/workspace-live-refresh";
import { SiteEmailPanel, SiteEmailPreview } from "@/components/site-email-panel";
import type { SiteEmailDashboard } from "@/lib/site-email";

function ServiceDue({ service, today }: { service?: SiteServiceRecord; today: string }) {
  if (!service) return <span className="site-muted">Da inserire</span>;
  const status = getSiteRenewalState(service, today);
  const labels = { MISSING: "Data da inserire", UNCONFIRMED: "Anno da confermare", OVERDUE: "Scaduto", UPCOMING: status.days === 0 ? "Scade oggi" : `Tra ${status.days} giorni`, CURRENT: "Oltre 30 giorni" };
  return <div className="site-due"><strong>{formatSiteDueDate(service)}</strong><span className={`site-status state-${status.state.toLowerCase()}`}>{labels[status.state]}</span>{service.provider ? <small>{service.provider}</small> : null}</div>;
}

type Editor = { kind: "site"; site?: ManagedSiteRecord } | { kind: "renewal" | "history" | "email-preview"; site: ManagedSiteRecord } | { kind: "email-settings" } | null;
const filters: [SiteFilter, string][] = [["ALL", "Tutti"], ["UPCOMING", "In scadenza"], ["OVERDUE", "Scaduti"], ["UNCONFIRMED", "Date da completare"], ["UNASSIGNED", "Da associare"], ["ARCHIVED", "Archiviati"]];

export function ManagedSitesWorkspace({ sites, customers, today, emailDashboard, canConfigureEmail }: { sites: ManagedSiteRecord[]; customers: SiteCustomer[]; today: string; emailDashboard: SiteEmailDashboard; canConfigureEmail: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SiteFilter>("ALL");
  const [editor, setEditor] = useState<Editor>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = sites.filter(site => !site.archivedAt);
  const visible = filterManagedSites(sites, query, filter, today);
  const count = (value: SiteFilter) => filterManagedSites(sites, "", value, today).length;
  async function change(site: ManagedSiteRecord, operation: "ARCHIVE" | "RESTORE" | "ASSOCIATE", customer?: SiteCustomer) {
    setBusyId(site.id); setError(""); setNotice("");
    try {
      const result = operation === "ASSOCIATE" ? await associateSiteAction(site.id, site.version, customer!.id) : await archiveSiteAction(site.id, site.version, operation === "ARCHIVE");
      if (!result.ok) setError(result.error); else setNotice(operation === "ASSOCIATE" ? `${site.hostname} associato a ${customer!.name}.` : operation === "ARCHIVE" ? "Sito archiviato." : "Sito ripristinato.");
      router.refresh();
    } catch { setError("Operazione non riuscita. Riprova."); } finally { setBusyId(null); }
  }
  const saved = (message: string) => { setEditor(null); setError(""); setNotice(message); };
  return <div className="managed-sites-page">
    <WorkspaceLiveRefresh />
    <header className="sites-page-head"><h1>Siti</h1><div className="sites-head-actions"><button type="button" className="site-button" onClick={() => setEditor({ kind: "email-settings" })}>Avvisi email</button><button type="button" className="site-button primary" onClick={() => setEditor({ kind: "site" })}>+ Nuovo sito</button></div></header>
    <section className="sites-metrics" aria-label="Riepilogo siti">{[
      ["Siti gestiti", active.length, "all", "ALL"], ["Entro 30 giorni", count("UPCOMING"), "upcoming", "UPCOMING"], ["Scaduti", count("OVERDUE"), "overdue", "OVERDUE"], ["Date da completare", count("UNCONFIRMED"), "unconfirmed", "UNCONFIRMED"], ["Da associare", count("UNASSIGNED"), "unassigned", "UNASSIGNED"]
    ].map(([label, value, tone, nextFilter]) => <button type="button" className={`sites-metric metric-${tone}`} key={label} onClick={() => setFilter(nextFilter as SiteFilter)}><span>{label}</span><strong>{value}</strong></button>)}</section>
    <section className="sites-list-panel">
      <div className="sites-list-toolbar"><nav aria-label="Filtri siti">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</nav><input aria-label="Cerca siti" placeholder="Cerca sito, cliente o provider" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} /></div>
      {error ? <p className="site-error" role="alert">{error}</p> : null}{notice ? <p className="site-notice" role="status">{notice}</p> : null}
      <div className="sites-table-wrap"><table className="sites-table"><thead><tr><th>Sito</th><th>Cliente</th><th>Hosting</th><th>Dominio</th><th>Rinnovo</th><th>Azioni</th></tr></thead><tbody>{visible.map(site => {
        const hosting = site.services.find(service => service.kind === "HOSTING");
        const domain = site.services.find(service => service.kind === "DOMAIN");
        const suggestions = site.customerId ? [] : suggestSiteCustomers(site.hostname, customers);
        const states = getSiteServicesToMonitor(site).map(service => getSiteRenewalState(service, today).state);
        const state = states.includes("OVERDUE") ? "overdue" : states.includes("UPCOMING") ? "upcoming" : "normal";
        return <tr key={site.id} className={`site-row state-${state}${site.archivedAt ? " is-archived" : ""}`}>
          <td data-label="Sito"><div className="site-domain"><a href={`https://${site.hostname}`} target="_blank" rel="noopener noreferrer">{site.hostname}<span aria-hidden="true"> ↗</span></a>{site.name ? <span>{site.name}</span> : null}{site.emailRemindersEnabled ? <span className="site-email-active-label">Avvisi email abilitati</span> : null}</div></td>
          <td data-label="Cliente"><div className="site-customer-cell">{site.customer ? <Link href={`/customers/${site.customer.id}`}>{site.customer.name}</Link> : <><span className="site-muted">Da associare</span>{!site.archivedAt ? suggestions.map(customer => <button type="button" className="site-customer-suggestion" key={customer.id} aria-label={`Associa ${site.hostname} a ${customer.name}`} disabled={busyId !== null} onClick={() => change(site, "ASSOCIATE", customer)}>+ {customer.name}</button>) : null}</>}</div></td>
          <td data-label="Hosting"><ServiceDue service={hosting} today={today} /></td>
          <td data-label="Dominio">{site.domainRenewalMode === "SEPARATE" ? <ServiceDue service={domain} today={today} /> : <span className={`site-domain-mode mode-${site.domainRenewalMode.toLowerCase()}`}>{domainRenewalLabels[site.domainRenewalMode]}</span>}</td>
          <td data-label="Rinnovo"><div className="site-renewal-summary"><strong>{hosting?.costCents !== null && hosting?.costCents !== undefined ? formatCurrency(hosting.costCents) : "—"}</strong>{hosting?.autoRenew !== null && hosting?.autoRenew !== undefined ? <span>{hosting.autoRenew ? "Automatico" : "Manuale"}</span> : null}</div></td>
          <td data-label="Azioni"><div className="site-row-actions">{site.archivedAt ? <button type="button" className="site-button" disabled={busyId !== null} onClick={() => change(site, "RESTORE")}>Ripristina</button> : <><button type="button" className="site-button" disabled={busyId !== null} aria-label={`Gestisci ${site.hostname}`} onClick={() => setEditor({ kind: "site", site })}>Gestisci</button><button type="button" className="site-button renew" disabled={busyId !== null} aria-label={`Registra rinnovo ${site.hostname}`} onClick={() => setEditor({ kind: "renewal", site })}>Rinnovo</button><button type="button" className="site-button quiet" disabled={busyId !== null} aria-label={`Archivia ${site.hostname}`} onClick={() => change(site, "ARCHIVE")}>Archivia</button></>}
            <button type="button" className="site-button quiet" aria-label={`Anteprima email ${site.hostname}`} onClick={() => setEditor({ kind: "email-preview", site })}>Anteprima email</button>
            {site.services.some(service => service.renewals.length > 0) ? <button type="button" className="site-button quiet" aria-label={`Storico rinnovi ${site.hostname}`} onClick={() => setEditor({ kind: "history", site })}>Storico</button> : null}</div></td>
        </tr>;
      })}</tbody></table>{!visible.length ? <div className="sites-empty">{sites.length ? "Nessun sito per questa ricerca" : "Nessun sito inserito"}</div> : null}</div>
      <footer className="sites-list-footer">{visible.length} {visible.length === 1 ? "sito" : "siti"}</footer>
    </section>
    {editor?.kind === "site" ? <SiteEditor key={editor.site?.id || "new"} site={editor.site} customers={customers} onClose={() => setEditor(null)} onSaved={() => saved("Sito salvato.")} /> : null}
    {editor?.kind === "renewal" ? <SiteRenewalEditor key={editor.site.id} site={editor.site} today={today} onClose={() => setEditor(null)} onSaved={() => saved("Rinnovo registrato e scadenza aggiornata.")} /> : null}
    {editor?.kind === "email-settings" ? <SiteEmailPanel data={emailDashboard} canConfigure={canConfigureEmail} onClose={() => setEditor(null)} /> : null}
    {editor?.kind === "email-preview" ? <SiteEmailPreview site={editor.site} settings={emailDashboard.settings} today={today} onClose={() => setEditor(null)} /> : null}
    {editor?.kind === "history" ? <SiteDialog title={`Rinnovi · ${editor.site.hostname}`} onClose={() => setEditor(null)}><div className="site-renewal-history">{editor.site.services.flatMap(service => service.renewals.map(renewal => ({ ...renewal, kind: service.kind }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(renewal => <article key={renewal.id}><header><strong>{renewal.includesDomain ? "Hosting e dominio" : siteServiceLabels[renewal.kind]}</strong><span>{formatDate(`${renewal.renewedOn}T12:00:00Z`)}</span></header><p>{renewal.previousDueLabel} → {formatDate(`${renewal.nextDueDate}T12:00:00Z`)}</p>{renewal.costCents !== null ? <strong>{formatCurrency(renewal.costCents)}</strong> : null}{renewal.note ? <p>{renewal.note}</p> : null}<small>{renewal.recordedBy}</small></article>)}</div></SiteDialog> : null}
  </div>;
}
