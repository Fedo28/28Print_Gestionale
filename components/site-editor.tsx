"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSiteAction } from "@/app/sites/actions";
import { blankSiteService, suggestSiteCustomers } from "@/lib/managed-sites-domain";
import type { DomainRenewalMode, ManagedSiteInput, ManagedSiteRecord, SiteCustomer, SiteServiceInput } from "@/lib/managed-sites-domain";
import { createSearchIndexValue, createSearchMatcher, matchesSearchIndexValue } from "@/lib/search-text";
import { SiteDialog } from "@/components/site-dialog";

function CustomerPicker({ customers, hostname, selectedId, onSelect, query, onQueryChange }: {
  customers: SiteCustomer[]; hostname: string; selectedId: string | null; onSelect: (customer: SiteCustomer | null) => void;
  query: string; onQueryChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const matcher = createSearchMatcher(query);
  const suggested = suggestSiteCustomers(hostname, customers);
  const options = (query.trim() ? customers.filter(customer => matchesSearchIndexValue(createSearchIndexValue(customer.name), matcher)) : suggested.length ? suggested : customers).slice(0, 8);
  function select(customer: SiteCustomer) { onSelect(customer); setOpen(false); }
  return <div className="site-field site-customer-picker"><label htmlFor={id}>Cliente</label><div className="site-customer-input"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined}
    aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined} autoComplete="off" placeholder="Cerca o associa più avanti" value={query}
    onFocus={() => { clearTimeout(closeTimer.current); setOpen(true); }} onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 120); }}
    onChange={event => { onQueryChange(event.target.value); setActive(0); setOpen(true); }} onKeyDown={event => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(current => Math.min(current + 1, options.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive(current => Math.max(current - 1, 0)); }
      if (event.key === "Enter" && open && options[active]) { event.preventDefault(); select(options[active]); }
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    }} />{selectedId || query ? <button type="button" aria-label="Rimuovi cliente associato" onClick={() => { onSelect(null); setOpen(false); }}>×</button> : null}</div>
    {open ? <div className="site-customer-options" role="listbox" id={`${id}-options`} aria-label="Clienti da associare">{options.length ? options.map((customer, index) => <button type="button" role="option" id={`${id}-option-${index}`} aria-selected={selectedId === customer.id} className={active === index ? "is-active" : ""} key={customer.id}
      onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => select(customer)}>{customer.name}</button>) : <span>Nessun cliente trovato</span>}</div> : null}
  </div>;
}

export function SiteServiceFields({ value, onChange, prefix, required }: { value: SiteServiceInput; onChange: (value: SiteServiceInput) => void; prefix: string; required?: boolean }) {
  const patch = (changes: Partial<SiteServiceInput>) => onChange({ ...value, ...changes });
  const number = (raw: string) => raw === "" ? null : Number(raw);
  const [cost, setCost] = useState(value.costCents === null ? "" : (value.costCents / 100).toFixed(2));
  return <>
    <div className="site-date-fields"><div className="site-field"><label htmlFor={`${prefix}-day`}>Giorno</label><input id={`${prefix}-day`} type="number" min={1} max={31} required={required} value={value.renewalDay ?? ""} onChange={event => patch({ renewalDay: number(event.target.value) })} /></div>
      <div className="site-field"><label htmlFor={`${prefix}-month`}>Mese</label><select id={`${prefix}-month`} required={required} value={value.renewalMonth ?? ""} onChange={event => patch({ renewalMonth: number(event.target.value) })}><option value="">Scegli</option>{["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"].map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
      <div className="site-field"><label htmlFor={`${prefix}-year`}>Anno</label><input id={`${prefix}-year`} type="number" min={1900} max={2200} placeholder="Da confermare" value={value.renewalYear ?? ""} onChange={event => patch({ renewalYear: number(event.target.value) })} /></div></div>
    <div className="site-form-pair"><div className="site-field"><label htmlFor={`${prefix}-provider`}>Provider</label><input id={`${prefix}-provider`} maxLength={180} value={value.provider} onChange={event => patch({ provider: event.target.value })} /></div>
      <div className="site-field"><label htmlFor={`${prefix}-cost`}>Costo annuo €</label><input id={`${prefix}-cost`} type="number" min={0} step="0.01" value={cost} onChange={event => { setCost(event.target.value); patch({ costCents: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) }); }} /></div></div>
    <div className="site-field"><label htmlFor={`${prefix}-auto`}>Rinnovo</label><select id={`${prefix}-auto`} value={value.autoRenew === null ? "unknown" : value.autoRenew ? "automatic" : "manual"} onChange={event => patch({ autoRenew: event.target.value === "unknown" ? null : event.target.value === "automatic" })}><option value="unknown">Da verificare</option><option value="manual">Manuale</option><option value="automatic">Automatico</option></select></div>
  </>;
}

export function SiteEditor({ site, customers, onClose, onSaved }: { site?: ManagedSiteRecord; customers: SiteCustomer[]; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState<ManagedSiteInput>({ id: site?.id, version: site?.version, hostname: site?.hostname || "", name: site?.name || "", customerId: site?.customerId || null,
    domainRenewalMode: site?.domainRenewalMode || "UNKNOWN", notes: site?.notes || "", emailRemindersEnabled: site?.emailRemindersEnabled || false, renewalEmail: site?.renewalEmail || null,
    hosting: site?.services.find(service => service.kind === "HOSTING") || { ...blankSiteService }, domain: site?.services.find(service => service.kind === "DOMAIN") || null });
  const [customerQuery, setCustomerQuery] = useState(site?.customer?.name || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const patch = (changes: Partial<ManagedSiteInput>) => setInput(current => ({ ...current, ...changes }));
  return <SiteDialog title={site ? site.hostname : "Nuovo sito"} busy={busy} onClose={onClose}>
    <form className="site-form" onSubmit={async event => {
      event.preventDefault(); setError("");
      if (customerQuery.trim() && !input.customerId) { setError("Seleziona il cliente dall’elenco oppure svuota il campo."); return; }
      setBusy(true);
      try { const result = await saveSiteAction(input); if (!result.ok) setError(result.error); else { onSaved(); router.refresh(); } }
      catch { setError("Salvataggio non riuscito. Riprova."); } finally { setBusy(false); }
    }}>
      <div className="site-form-pair"><div className="site-field"><label htmlFor="site-hostname">Dominio del sito</label><input id="site-hostname" required maxLength={300} placeholder="nome-sito.it" value={input.hostname} onChange={event => patch({ hostname: event.target.value })} /></div><div className="site-field"><label htmlFor="site-name">Nome</label><input id="site-name" maxLength={180} value={input.name} onChange={event => patch({ name: event.target.value })} /></div></div>
      <CustomerPicker customers={customers} hostname={input.hostname} query={customerQuery} selectedId={input.customerId} onQueryChange={value => { setCustomerQuery(value); patch({ customerId: null }); }} onSelect={customer => { patch({ customerId: customer?.id || null }); setCustomerQuery(customer?.name || ""); }} />
      <fieldset><legend>Web hosting</legend><SiteServiceFields prefix="hosting" value={input.hosting} required onChange={hosting => patch({ hosting })} /></fieldset>
      <fieldset><legend>Dominio</legend><div className="site-field"><label htmlFor="site-domain-mode">Scadenza del dominio</label><select id="site-domain-mode" value={input.domainRenewalMode} onChange={event => patch({ domainRenewalMode: event.target.value as DomainRenewalMode, ...(event.target.value === "SEPARATE" && !input.domain ? { domain: { ...blankSiteService } } : {}) })}><option value="UNKNOWN">Da verificare</option><option value="TOGETHER">Stesso rinnovo dell’hosting</option><option value="SEPARATE">Rinnovo separato</option></select></div>
        {input.domainRenewalMode === "SEPARATE" ? <SiteServiceFields prefix="domain" value={input.domain || blankSiteService} onChange={domain => patch({ domain })} /> : null}
      </fieldset>
      <fieldset><legend>Avviso rinnovo</legend><label className="site-email-toggle"><input type="checkbox" checked={Boolean(input.emailRemindersEnabled)} onChange={event => patch({ emailRemindersEnabled: event.target.checked })} />Avvisi email per questo sito</label>
        <div className="site-field"><label htmlFor="site-renewal-email">Email avvisi</label><input id="site-renewal-email" type="email" maxLength={254} placeholder="Usa l’email del cliente" value={input.renewalEmail || ""} onChange={event => patch({ renewalEmail: event.target.value || null })} /></div></fieldset>
      <div className="site-field"><label htmlFor="site-notes">Note</label><textarea id="site-notes" rows={3} maxLength={4000} value={input.notes} onChange={event => patch({ notes: event.target.value })} /></div>
      {error ? <p className="site-error" role="alert">{error}</p> : null}
      <footer><button type="button" className="site-button quiet" disabled={busy} onClick={onClose}>Annulla</button><button type="submit" className="site-button primary" disabled={busy}>{busy ? "Salvataggio…" : "Salva sito"}</button></footer>
    </form>
  </SiteDialog>;
}
