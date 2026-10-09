"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction, reorderNotesAction, saveNoteAction } from "@/app/my-day/actions";
import { noteColorLabels } from "@/lib/personal-workspace-domain";
import type { NoteColor, WorkspaceNote } from "@/lib/personal-workspace-domain";

function NoteCard({ note, index, total, onMove, onDrag, onDrop }: {
  note: WorkspaceNote; index: number; total: number; onMove: (id: string, direction: -1 | 1) => void;
  onDrag: (id: string) => void; onDrop: (id: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = draft.title !== note.title || draft.content !== note.content || draft.color !== note.color;
  useEffect(() => { if (!dirty && !busy && note.version >= draft.version) setDraft(note); }, [note, dirty, busy, draft.version]);
  async function save(archive?: boolean) {
    setBusy(true); setError("");
    try {
      const result = await saveNoteAction({ id: note.id, version: draft.version, title: draft.title, content: draft.content, color: draft.color }, archive);
      if (result.ok) { setDraft(result.value); router.refresh(); } else setError(result.error);
    } catch { setError("Salvataggio non riuscito. Il testo resta qui: riprova."); }
    finally { setBusy(false); }
  }
  return <article className={`personal-post-it tone-${draft.color.toLowerCase()}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(note.id); }}>
    <div className="post-it-top"><button type="button" draggable className="post-it-drag" aria-label="Trascina post-it" onDragStart={(event) => { event.dataTransfer.setData("text/plain", note.id); onDrag(note.id); }}>⠿</button>
      <select aria-label="Colore post-it" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value as NoteColor }))} disabled={busy}>{Object.entries(noteColorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button type="button" className="post-it-archive" aria-label={`Metti via post-it ${draft.title || "senza titolo"}`} onClick={() => save(true)} disabled={busy}>↗</button></div>
    <input className="post-it-title" aria-label="Titolo post-it" placeholder="Un pensiero al volo" value={draft.title} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
    <textarea aria-label="Testo post-it" placeholder="Scrivi qui quello che vuoi ricordare…" value={draft.content} maxLength={8000} rows={5} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
    <div className="post-it-bottom"><span role="status">{busy ? "Salvataggio…" : dirty ? "Da salvare" : "Salvato"}</span>
      <div><button type="button" aria-label="Sposta post-it a sinistra" disabled={index === 0 || busy} onClick={() => onMove(note.id, -1)}>←</button><button type="button" aria-label="Sposta post-it a destra" disabled={index === total - 1 || busy} onClick={() => onMove(note.id, 1)}>→</button>
        <button type="button" onClick={() => save()} disabled={!dirty || busy}>Salva</button></div></div>
    {error ? <div role="alert" className="workspace-error">{error}<button type="button" onClick={() => { setDraft(note); setError(""); router.refresh(); }}>Ricarica post-it</button></div> : null}
  </article>;
}

export function PersonalNotes({ notes }: { notes: WorkspaceNote[] }) {
  const router = useRouter();
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = notes.filter((note) => !note.archivedAt);
  const archived = notes.filter((note) => note.archivedAt);
  const ordered = orderedIds ? [...active].sort((left, right) => orderedIds.indexOf(left.id) - orderedIds.indexOf(right.id)) : active;
  useEffect(() => { setOrderedIds(null); }, [notes]);
  async function addNote() {
    setBusy(true); setError("");
    try { const result = await createNoteAction(); if (!result.ok) setError(result.error); router.refresh(); }
    catch { setError("Impossibile creare il post-it. Riprova."); } finally { setBusy(false); }
  }
  async function moveTo(id: string, target: string) {
    if (busy || id === target) return;
    const ids = ordered.map((note) => note.id);
    const from = ids.indexOf(id); const to = ids.indexOf(target);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, id);
    setOrderedIds(ids); setBusy(true); setError("");
    try { const result = await reorderNotesAction(ids); if (!result.ok) { setError(result.error); setOrderedIds(null); } router.refresh(); }
    catch { setError("Non ho salvato la nuova posizione. Riprova."); setOrderedIds(null); } finally { setBusy(false); setDraggedId(null); }
  }
  async function restore(note: WorkspaceNote) {
    setBusy(true); setError("");
    try { const result = await saveNoteAction(note, false); if (!result.ok) setError(result.error); router.refresh(); }
    catch { setError("Ripristino non riuscito. Riprova."); } finally { setBusy(false); }
  }
  return <section className="personal-notes-section" aria-labelledby="personal-notes-title">
    <header className="workspace-section-head"><div><h2 id="personal-notes-title">Il tuo pacchetto note</h2></div>
      <button type="button" className="button workspace-note-add" onClick={addNote} disabled={busy}>{busy ? "Un momento…" : "+ Nuovo post-it"}</button></header>
    {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    {active.length ? <div className="personal-notes-grid">{ordered.map((note, index) => <NoteCard key={note.id} note={note} index={index} total={ordered.length}
      onDrag={setDraggedId} onDrop={(target) => { if (draggedId) void moveTo(draggedId, target); }} onMove={(id, direction) => { const target = ordered[index + direction]; if (target) void moveTo(id, target.id); }} />)}</div>
      : <div className="personal-notes-empty"><span aria-hidden="true">✎</span><strong>Nessun post-it</strong></div>}
    {archived.length ? <details className="workspace-archive"><summary>Post-it messi via ({archived.length})</summary><div>{archived.map((note) => <article key={note.id}><strong>{note.title || "Post-it senza titolo"}</strong><p>{note.content}</p><button type="button" onClick={() => restore(note)} disabled={busy}>Ripristina</button></article>)}</div></details> : null}
  </section>;
}
