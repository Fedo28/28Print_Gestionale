"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pickWorkAction } from "@/app/my-day/actions";
import { mainPhaseLabels, normalizeMainPhaseForWorkflow } from "@/lib/constants";
import type { MainPhase } from "@prisma/client";
import { formatCompactDate } from "@/lib/format";
import { buildWorkPickerEntries, filterWorkPickerEntries } from "@/lib/workspace-work-picker";
import type { WorkPickerEntry, WorkPickerFilter } from "@/lib/workspace-work-picker";
import type { WorkspacePickerOrder, WorkspaceTask } from "@/lib/personal-workspace-domain";
import { isTaskParticipant } from "@/lib/personal-workspace-domain";

export function WorkspaceWorkPicker({ orders, tasks, userId, onPicked, onOrganize }: {
  orders: WorkspacePickerOrder[]; tasks: WorkspaceTask[]; userId: string;
  onPicked: (task: WorkspaceTask) => void; onOrganize: (task: WorkspaceTask) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WorkPickerFilter>("ALL");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTaskId, setNoticeTaskId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, WorkspaceTask>>({});
  useEffect(() => {
    setPicked((current) => {
      const waiting = Object.entries(current).filter(([id, task]) => !tasks.some((saved) => saved.id === id && saved.version >= task.version));
      return waiting.length === Object.keys(current).length ? current : Object.fromEntries(waiting);
    });
  }, [tasks]);
  useEffect(() => {
    const updated = tasks.find((task) => task.id === noticeTaskId);
    if (updated && (!isTaskParticipant(updated, userId) || updated.archivedAt || updated.status === "DONE")) setNotice("");
  }, [tasks, noticeTaskId, userId]);
  const mergedTasks = useMemo(() => {
    const result = new Map(tasks.map((task) => [task.id, task]));
    for (const task of Object.values(picked)) if (!result.has(task.id) || result.get(task.id)!.version < task.version) result.set(task.id, task);
    return [...result.values()];
  }, [tasks, picked]);
  const entries = useMemo(() => buildWorkPickerEntries(orders, mergedTasks, userId), [orders, mergedTasks, userId]);
  const visibleEntries = useMemo(() => filterWorkPickerEntries(entries, query, filter), [entries, query, filter]);
  async function pick(entry: WorkPickerEntry) {
    setBusyKey(entry.key); setError(""); setNotice("");
    try {
      const result = await pickWorkAction(entry.selection);
      if (!result.ok) setError(result.error);
      else {
        setPicked((current) => ({ ...current, [result.value.id]: result.value }));
        onPicked(result.value);
        setNoticeTaskId(result.value.id);
        setNotice(result.value.scheduledDate
          ? `${entry.title}: aggiunto ai tuoi incarichi, già programmato per il ${formatCompactDate(`${result.value.scheduledDate}T12:00:00Z`)}.`
          : `${entry.title}: aggiunto in “Da organizzare”.`);
      }
      router.refresh();
    } catch { setError("Non ho aggiunto il lavoro. Riprova."); }
    finally { setBusyKey(null); }
  }
  return <section className="workspace-work-picker" aria-labelledby="work-picker-title">
    <header className="work-picker-head"><div><h2 id="work-picker-title">Lavori e commissioni</h2></div><span className="work-picker-count">{entries.length} lavori aperti</span></header>
    <div className="work-picker-toolbar"><div className="work-picker-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input aria-label="Cerca lavori e commissioni" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca cliente, lavoro o collega" />{query ? <button type="button" aria-label="Pulisci ricerca lavori" onClick={() => setQuery("")}>×</button> : null}</div>
      <select aria-label="Filtra lavori disponibili" value={filter} onChange={(event) => setFilter(event.target.value as WorkPickerFilter)}><option value="ALL">Tutti i lavori</option><option value="FREE">Liberi</option><option value="FOLLOWED">Seguiti da altri</option><option value="MINE">Già nei miei incarichi</option></select></div>
    {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    {notice ? <p className="work-picker-notice" role="status">{notice}</p> : null}
    <div className="work-picker-list" tabIndex={0} role="region" aria-label="Elenco dei lavori da scegliere"><ul>{visibleEntries.map((entry) => <li key={entry.key} className={`work-picker-row${entry.mine ? " is-mine" : ""}`}>
      <div className="work-picker-copy"><div className="work-picker-row-top"><span>{entry.kindLabel}</span>{entry.mainPhase ? <span>{mainPhaseLabels[normalizeMainPhaseForWorkflow(entry.mainPhase as MainPhase)]}</span> : null}</div>
        {entry.selection.kind === "order" ? <Link href={`/orders/${entry.selection.id}`}>{entry.title}</Link> : <strong>{entry.title}</strong>}
        <div className="work-picker-row-meta">{entry.customerName ? <span>{entry.customerName}</span> : null}{entry.deliveryAt ? <span>Consegna {formatCompactDate(entry.deliveryAt)}</span> : null}
          {entry.task?.scheduledDate ? <span>Incarico {formatCompactDate(`${entry.task.scheduledDate}T12:00:00Z`)}{entry.task.startTime ? ` · ${entry.task.startTime}` : ""}</span> : null}</div></div>
      <div className="work-picker-people">{entry.mine ? <span className="work-picker-mine-label">✓ Nei tuoi incarichi</span> : entry.task?.owner ? <span>Segue {entry.task.owner.name}</span> : entry.task?.collaborators.length ? <span>Collaborano {entry.task.collaborators.map((person) => person.user.name).join(", ")}</span> : entry.relatedPeople.length ? <span>Attività con {entry.relatedPeople.join(", ")}</span> : <span className="work-picker-free-label">Libero</span>}</div>
      <div className="work-picker-row-action">{entry.mine && entry.task ? <button type="button" className="work-picker-organize" onClick={() => onOrganize(entry.task!)}>Organizza</button> : <button type="button" className="work-picker-add" aria-label={`${entry.task?.ownerId ? "Collabora a" : "Prendi in carico"} ${entry.title}`} onClick={() => pick(entry)} disabled={busyKey !== null}><span aria-hidden="true">{busyKey === entry.key ? "…" : "+"}</span>{entry.task?.ownerId ? "Collabora" : "Aggiungi"}</button>}</div>
    </li>)}</ul>{!visibleEntries.length ? <div className="work-picker-empty">{entries.length ? "Nessun risultato" : "Nessun lavoro aperto"}</div> : null}</div>
    <footer className="work-picker-footer">{visibleEntries.length} {visibleEntries.length === 1 ? "lavoro nella lista" : "lavori nella lista"}</footer>
  </section>;
}
