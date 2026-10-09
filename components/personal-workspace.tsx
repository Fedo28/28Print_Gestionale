"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { taskParticipationAction } from "@/app/my-day/actions";
import { canManageTask, getWeekDays, isTaskParticipant, isValidDay, shiftDay, taskStatusLabels } from "@/lib/personal-workspace-domain";
import type { WorkspaceActor, WorkspaceNote, WorkspacePickerOrder, WorkspaceProfile, WorkspaceTask } from "@/lib/personal-workspace-domain";
import { formatCompactDate } from "@/lib/format";
import { PersonalNotes } from "@/components/personal-notes";
import { WorkTaskEditor } from "@/components/work-task-editor";
import { WorkspaceWorkPicker } from "@/components/workspace-work-picker";
import { WorkspaceLiveRefresh } from "@/components/workspace-live-refresh";
import { WorkspaceWeekTask } from "@/components/workspace-week-task";

type View = "day" | "week" | "inbox";
type Scope = "mine" | "team";
type Operation = "JOIN" | "TAKE" | "LEAVE" | "DONE" | "REOPEN" | "ARCHIVE" | "RESTORE";
type Editor = { task?: WorkspaceTask; orderId?: string; date?: string };

function dayLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone: "Europe/Rome" }).format(new Date(`${day}T12:00:00Z`));
}

function TaskCard({ task, actor, compact, weekDetails, busy, onEdit, onAction }: {
  task: WorkspaceTask; actor: WorkspaceActor; compact?: boolean; busy: boolean;
  weekDetails?: { open: boolean; onOpen: () => void; onClose: () => void };
  onEdit: (task: WorkspaceTask) => void; onAction: (task: WorkspaceTask, operation: Operation) => void;
}) {
  const editable = canManageTask(task, actor);
  const involved = isTaskParticipant(task, actor.id);
  const weekly = Boolean(weekDetails);
  const top = <div className="workspace-task-top"><span className={`workspace-task-status status-${task.status.toLowerCase()}`}>{task.archivedAt ? "Messo via" : taskStatusLabels[task.status]}</span>
      {task.startTime ? <span className="workspace-task-time">{task.startTime}{task.endTime ? `–${task.endTime}` : ""}</span> : null}</div>;
  const information = <>
    {task.order ? <Link className="workspace-task-order" href={`/orders/${task.order.id}`}>{task.order.customerName}<span>{task.order.title}</span></Link> : <span className="workspace-task-kind">Commissione libera</span>}
    {task.description ? compact && !weekly ? <details className="workspace-task-details"><summary>Dettagli</summary><p className="workspace-task-description">{task.description}</p></details> : <p className="workspace-task-description">{task.description}</p> : null}
    <div className="workspace-task-people"><span className="workspace-owner-chip">{task.owner?.name || "Da assegnare"}{task.ownerId === actor.id ? " · tu" : ""}</span>
      {task.collaborators.map((person) => <span className="workspace-collaborator-chip" key={person.userId}>{person.user.name}{person.role ? ` · ${person.role}` : ""}</span>)}</div>
    {!compact || weekly ? <div className="workspace-task-dates"><span>{task.scheduledDate ? dayLabel(task.scheduledDate, { day: "numeric", month: "short" }) : "Giorno da scegliere"}</span>
      {task.order ? <span>Consegna cliente {formatCompactDate(task.order.deliveryAt)}{task.order.mainPhase === "CONSEGNATO" ? " · ordine consegnato" : ""}</span> : null}</div> : null}
  </>;
  const actions = <div className="workspace-task-actions">
      {task.archivedAt ? editable ? <button type="button" onClick={() => onAction(task, "RESTORE")} disabled={busy}>Ripristina</button> : null : <>
        {editable ? <button type="button" onClick={() => onEdit(task)} disabled={busy}>Organizza</button> : null}
        {editable ? <button type="button" className="workspace-task-complete" onClick={() => onAction(task, task.status === "DONE" ? "REOPEN" : "DONE")} disabled={busy}>{task.status === "DONE" ? "Riapri" : "✓ Fatto"}</button> : null}
        {task.status !== "DONE" && !involved ? <button type="button" onClick={() => onAction(task, task.ownerId ? "JOIN" : "TAKE")} disabled={busy}>{task.ownerId ? "Collabora" : "Lo seguo io"}</button> : null}
        {involved && task.status !== "DONE" ? <button type="button" className="workspace-task-quiet" onClick={() => onAction(task, "LEAVE")} disabled={busy}>Lascia</button> : null}
        {editable && !compact ? <button type="button" className="workspace-task-quiet" onClick={() => onAction(task, "ARCHIVE")} disabled={busy}>Metti via</button> : null}
      </>}
    </div>;
  if (weekDetails) return <WorkspaceWeekTask taskId={task.id} title={task.title} status={task.status} details={<>{top}{information}</>} actions={actions} {...weekDetails} />;
  return <article className={`workspace-task-card status-${task.status.toLowerCase()}${compact ? " is-compact" : ""}`}>
    {top}<h3>{task.title}</h3>{information}{actions}
  </article>;
}

export function PersonalWorkspace({ actor, profileName, profiles, tasks, notes, orders, today, initialDate, initialScope, initialView, initialOrderId, initialTaskId }: {
  actor: WorkspaceActor; profileName: string; profiles: WorkspaceProfile[]; tasks: WorkspaceTask[]; notes: WorkspaceNote[];
  orders: WorkspacePickerOrder[]; today: string; initialDate: string; initialScope: Scope; initialView: View;
  initialOrderId?: string; initialTaskId?: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState(initialDate);
  const [personFilter, setPersonFilter] = useState("");
  const [editor, setEditor] = useState<Editor | null>(() => {
    const task = tasks.find((task) => task.id === initialTaskId);
    if (task && !task.archivedAt && canManageTask(task, actor)) return { task };
    return initialOrderId && orders.some((order) => order.id === initialOrderId) ? { orderId: initialOrderId } : null;
  });
  const [expandedWeekTaskId, setExpandedWeekTaskId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { setScope(initialScope); setView(initialView); setDate(initialDate); }, [initialScope, initialView, initialDate]);
  function navigate(nextScope: Scope, nextView: View, nextDate: string) {
    setExpandedWeekTaskId(null);
    if (!isValidDay(nextDate)) nextDate = today;
    setScope(nextScope); setView(nextView); setDate(nextDate);
    const params = new URLSearchParams();
    if (nextScope === "team") params.set("scope", "team");
    if (nextView !== "day") params.set("view", nextView);
    if (nextDate !== today) params.set("date", nextDate);
    router.replace(`/my-day${params.size ? `?${params}` : ""}`, { scroll: false });
  }
  function closeEditor() { setEditor(null); if (initialTaskId || initialOrderId) navigate(scope, view, date); }
  async function action(task: WorkspaceTask, operation: Operation) {
    setBusyId(task.id); setError(""); setNotice("");
    try { const result = await taskParticipationAction(task.id, task.version, operation); if (!result.ok) setError(result.error);
      else setNotice({ JOIN: "Ora collabori a questo incarico.", TAKE: "Hai preso in carico la commissione.", LEAVE: "Hai lasciato l’incarico.", DONE: "Incarico segnato come fatto.", REOPEN: "Incarico riaperto.", ARCHIVE: "Incarico messo via. Puoi ripristinarlo dall’archivio.", RESTORE: "Incarico ripristinato." }[operation]);
      router.refresh(); }
    catch { setError("Operazione non riuscita. Riprova."); } finally { setBusyId(null); }
  }
  const scoped = tasks.filter((task) => scope === "mine" ? isTaskParticipant(task, actor.id) : !personFilter || isTaskParticipant(task, personFilter));
  const active = scoped.filter((task) => task.status !== "DONE" && !task.archivedAt);
  const history = scoped.filter((task) => task.status === "DONE" || task.archivedAt);
  const unscheduled = active.filter((task) => !task.scheduledDate);
  const earlier = active.filter((task) => task.scheduledDate && task.scheduledDate < today);
  const dayTasks = active.filter((task) => task.scheduledDate === date);
  const weekDays = getWeekDays(date);
  const renderTask = (task: WorkspaceTask, compact = false, weekly = false) => <TaskCard key={task.id} task={task} actor={actor} compact={compact}
    weekDetails={weekly ? { open: expandedWeekTaskId === task.id, onOpen: () => setExpandedWeekTaskId(task.id), onClose: () => setExpandedWeekTaskId((current) => current === task.id ? null : current) } : undefined}
    busy={busyId !== null} onEdit={(task) => setEditor({ task })} onAction={action} />;

  return <div className="personal-workspace">
    <WorkspaceLiveRefresh />
    <header className="personal-workspace-head"><div><span className="workspace-eyebrow">{profileName}</span><h1>Agenda</h1></div>
      <button type="button" className="button primary workspace-new-task" onClick={() => setEditor({})}>+ Nuova commissione</button></header>

    <section className="workspace-planner">
      <div className="workspace-planner-toolbar"><nav className="workspace-scope-switch" aria-label="Vista incarichi"><button type="button" className={scope === "mine" ? "active" : ""} aria-pressed={scope === "mine"} onClick={() => navigate("mine", view, date)}>I miei incarichi</button><button type="button" className={scope === "team" ? "active" : ""} aria-pressed={scope === "team"} onClick={() => navigate("team", view, date)}>La squadra</button></nav>
        {scope === "team" ? <select aria-label="Filtra incarichi per profilo" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="">Tutti i profili</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select> : null}</div>
      <div className="workspace-planner-navigation"><nav className="workspace-view-switch" aria-label="Periodo degli incarichi">{([ ["day", "Giornata"], ["week", "Settimana"], ["inbox", "Da organizzare"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} className={view === value ? "active" : ""} onClick={() => navigate(scope, value, date)}>{label}{value === "inbox" && unscheduled.length ? <span>{unscheduled.length}</span> : null}</button>)}</nav>
        {view !== "inbox" ? <div className="workspace-date-navigation"><button type="button" aria-label={view === "week" ? "Settimana precedente" : "Giorno precedente"} onClick={() => navigate(scope, view, shiftDay(date, view === "week" ? -7 : -1))}>←</button><input aria-label="Giorno da visualizzare" type="date" value={date} onChange={(event) => { if (event.target.value) navigate(scope, view, event.target.value); }} /><button type="button" aria-label={view === "week" ? "Settimana successiva" : "Giorno successivo"} onClick={() => navigate(scope, view, shiftDay(date, view === "week" ? 7 : 1))}>→</button><button type="button" onClick={() => navigate(scope, view, today)}>Oggi</button></div> : null}</div>
      {error ? <p className="workspace-error" role="alert">{error}</p> : null}
      {notice ? <p className="workspace-notice" role="status">{notice}</p> : null}

      {view === "day" ? <div className="workspace-day-layout"><section className="workspace-day-main"><header className="workspace-lane-head"><div><span className="workspace-eyebrow">{date === today ? "Oggi" : "In programma"}</span><h2>{dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}</h2></div><button type="button" onClick={() => setEditor({ date })} aria-label="Aggiungi incarico per questo giorno">+</button></header>
        {dayTasks.length ? <div className="workspace-task-list">{dayTasks.map((task) => renderTask(task))}</div> : <div className="workspace-day-empty"><span aria-hidden="true">☀</span><h3>Nessun incarico in programma</h3>{scope === "mine" ? <a href="#work-picker-title">Scegli dalla lista ↓</a> : <Link href="/orders">Vai agli ordini →</Link>}</div>}</section>
        <aside className="workspace-unscheduled-lane"><header className="workspace-lane-head"><div><h2>Da organizzare</h2></div><span className="workspace-lane-count">{unscheduled.length}</span></header>
          {unscheduled.length ? <div className="workspace-task-list">{unscheduled.map((task) => renderTask(task, true))}</div> : <p className="workspace-quiet-empty">Nessun incarico</p>}
          {earlier.length ? <details className="workspace-earlier"><summary>Programmati nei giorni precedenti ({earlier.length})</summary><div className="workspace-task-list">{earlier.map((task) => renderTask(task))}</div></details> : null}</aside></div> : null}

      {view === "week" ? <div className="workspace-week-shell"><div className="workspace-week-title"><h2>{dayLabel(weekDays[0], { day: "numeric", month: "short" })} — {dayLabel(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}</h2></div><div className="workspace-week-grid">{weekDays.map((day) => {
        const entries = active.filter((task) => task.scheduledDate === day);
        return <section key={day} className={`workspace-week-day${day === today ? " is-today" : ""}`}><header><div><span>{dayLabel(day, { weekday: "short" })}</span><strong>{dayLabel(day, { day: "numeric" })}</strong></div><button type="button" aria-label={`Aggiungi incarico ${dayLabel(day, { weekday: "long", day: "numeric" })}`} onClick={() => setEditor({ date: day })}>+</button></header><div>{entries.length ? entries.map((task) => renderTask(task, true, true)) : <span className="workspace-week-empty">Nessun incarico in agenda</span>}</div></section>;
      })}</div>{unscheduled.length ? <button className="workspace-unscheduled-link" type="button" onClick={() => navigate(scope, "inbox", date)}>{unscheduled.length} {unscheduled.length === 1 ? "incarico ancora" : "incarichi ancora"} da organizzare →</button> : null}</div> : null}

      {view === "inbox" ? <div className="workspace-inbox"><header className="workspace-lane-head"><div><h2>Da organizzare</h2></div></header>{unscheduled.length ? <div className="workspace-inbox-grid">{unscheduled.map((task) => renderTask(task))}</div> : <div className="workspace-quiet-empty">Nessun incarico senza data</div>}
        {earlier.length ? <details className="workspace-earlier"><summary>Programmati nei giorni precedenti ({earlier.length})</summary><div className="workspace-inbox-grid">{earlier.map((task) => renderTask(task))}</div></details> : null}</div> : null}

      {history.length ? <details className="workspace-archive"><summary>Conclusi e messi via ({history.length})</summary><div className="workspace-inbox-grid">{history.map((task) => renderTask(task))}</div></details> : null}
    </section>
    {scope === "mine" ? <><WorkspaceWorkPicker key={`picker-${actor.id}`} orders={orders} tasks={tasks} userId={actor.id}
      onPicked={() => { setError(""); setNotice(""); }} onOrganize={(task) => setEditor({ task })} /><PersonalNotes key={actor.id} notes={notes} /></> : null}
    {editor ? <WorkTaskEditor key={editor.task?.id || `new-${editor.orderId || ""}-${editor.date || ""}`} {...editor} userId={actor.id} profiles={profiles} orders={orders} onClose={closeEditor} onSaved={(task) => {
      setEditor(null); setPersonFilter(""); setNotice("Incarico salvato.");
      navigate(scope === "mine" && !isTaskParticipant(task, actor.id) ? "team" : scope,
        task.scheduledDate ? view === "week" ? "week" : "day" : "inbox", task.scheduledDate || date);
      router.refresh();
    }} /> : null}
  </div>;
}
