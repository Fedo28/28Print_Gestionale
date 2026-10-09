"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { saveTaskAction } from "@/app/my-day/actions";
import { taskStatusLabels } from "@/lib/personal-workspace-domain";
import type { TaskInput, TaskStatus, WorkspaceProfile, WorkspaceTask } from "@/lib/personal-workspace-domain";

export type WorkspaceOrderOption = { id: string; title: string; customerName: string };

export function WorkTaskEditor({ task, orderId, date, userId, profiles, orders, onClose, onSaved }: {
  task?: WorkspaceTask; orderId?: string; date?: string; userId: string; profiles: WorkspaceProfile[];
  orders: WorkspaceOrderOption[]; onClose: () => void; onSaved: (task: WorkspaceTask) => void;
}) {
  const [input, setInput] = useState<TaskInput>(() => ({
    id: task?.id, version: task?.version, title: task?.title || "", description: task?.description || "",
    orderId: task?.orderId || orderId || null, ownerId: task ? task.ownerId : userId,
    status: task?.status || "OPEN", scheduledDate: task?.scheduledDate || date || null,
    startTime: task?.startTime || null, endTime: task?.endTime || null,
    collaborators: task?.collaborators.map(({ userId, role }) => ({ userId, role })) || []
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  closeRef.current = onClose;
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]") || [])];
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [mounted]);
  const selectableOrders = task?.order && !orders.some((order) => order.id === task.orderId)
    ? [{ id: task.order.id, title: task.order.title, customerName: task.order.customerName }, ...orders] : orders;
  function patch<K extends keyof TaskInput>(key: K, value: TaskInput[K]) { setInput((current) => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await saveTaskAction(input);
      if (result.ok) onSaved(result.value); else setError(result.error);
    } catch { setError("Salvataggio non riuscito. Riprova: il testo resta nel modulo."); }
    finally { setBusy(false); }
  }
  return mounted ? createPortal(<div className="workspace-dialog-layer">
    <section ref={dialogRef} className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="work-task-editor-title">
      <header><div><h2 id="work-task-editor-title">{task ? "Il tuo incarico" : "Nuova commissione"}</h2></div>
        <button type="button" className="workspace-icon-button" aria-label="Chiudi incarico" onClick={onClose} disabled={busy}>×</button></header>
      <form onSubmit={save} className="workspace-task-form">
        <div className="field"><label htmlFor="task-title">Cosa c’è da fare</label><input id="task-title" required maxLength={180} value={input.title} onChange={(event) => patch("title", event.target.value)} /></div>
        <div className="workspace-form-pair">
          <div className="field"><label htmlFor="task-owner">Chi lo segue</label><select id="task-owner" value={input.ownerId || ""} onChange={(event) => {
            const ownerId = event.target.value || null;
            setInput((current) => ({ ...current, ownerId, collaborators: current.collaborators.filter((person) => person.userId !== ownerId) }));
          }}><option value="">Da assegnare</option>{profiles.map((profile) => <option key={profile.id} value={profile.id} disabled={!profile.active && profile.id !== task?.ownerId}>{profile.name} (@{profile.nickname}){profile.active ? "" : " · Disattivato"}</option>)}</select></div>
          <div className="field"><label htmlFor="task-status">Stato dell’incarico</label><select id="task-status" value={input.status} onChange={(event) => patch("status", event.target.value as TaskStatus)}>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="task-order">Ordine collegato · facoltativo</label><select id="task-order" disabled={Boolean(task?.claimKey)} value={input.orderId || ""} onChange={(event) => patch("orderId", event.target.value || null)}>
          <option value="">Commissione libera</option>{selectableOrders.map((order) => <option key={order.id} value={order.id}>{order.customerName} · {order.title}</option>)}</select>
        </div>
        <div className="workspace-scheduling-fields">
          <div className="field"><label htmlFor="task-day">Giorno · facoltativo</label><input id="task-day" type="date" value={input.scheduledDate || ""} onChange={(event) => setInput((current) => ({ ...current, scheduledDate: event.target.value || null,
            ...(event.target.value ? {} : { startTime: null, endTime: null }) }))} /></div>
          <div className="field"><label htmlFor="task-start">Dalle</label><input id="task-start" type="time" disabled={!input.scheduledDate} value={input.startTime || ""} onChange={(event) => patch("startTime", event.target.value || null)} /></div>
          <div className="field"><label htmlFor="task-end">Alle</label><input id="task-end" type="time" disabled={!input.scheduledDate} value={input.endTime || ""} onChange={(event) => patch("endTime", event.target.value || null)} /></div>
        </div>
        <div className="field"><label htmlFor="task-description">Dettagli</label><textarea id="task-description" rows={3} maxLength={4000} value={input.description} onChange={(event) => patch("description", event.target.value)} /></div>
        <fieldset className="workspace-collaborator-picker"><legend>Collaboratori · facoltativi</legend>
          <div>{profiles.filter((profile) => profile.id !== input.ownerId && (profile.active || input.collaborators.some((person) => person.userId === profile.id))).map((profile) => {
            const collaborator = input.collaborators.find((person) => person.userId === profile.id);
            return <div key={profile.id} className="workspace-collaborator-row"><label><input type="checkbox" checked={Boolean(collaborator)} onChange={(event) => patch("collaborators", event.target.checked
              ? [...input.collaborators, { userId: profile.id, role: "" }] : input.collaborators.filter((person) => person.userId !== profile.id))} />{profile.name}</label>
              {collaborator ? <input aria-label={`Ruolo di ${profile.name}`} placeholder="Es. stampa, montaggio…" maxLength={120} value={collaborator.role} onChange={(event) => patch("collaborators", input.collaborators.map((person) => person.userId === profile.id ? { ...person, role: event.target.value } : person))} /> : null}</div>;
          })}</div>
        </fieldset>
        {error ? <p role="alert" className="workspace-error">{error}</p> : null}
        <footer><button type="button" className="button ghost" onClick={onClose} disabled={busy}>Annulla</button><button type="submit" className="button primary" disabled={busy}>{busy ? "Salvataggio…" : "Salva incarico"}</button></footer>
      </form>
    </section>
  </div>, document.body) : null;
}
