"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimOrderAction, taskParticipationAction } from "@/app/my-day/actions";

export type OrderWorkAssignmentData = {
  id: string; ownerId: string | null; version: number;
  owner: { name: string } | null;
  collaborators: { userId: string; user: { name: string } }[];
};

export function OrderWorkAssignment({ orderId, userId, assignment, compact = false, taskCount = 0, activities = [] }: {
  orderId: string; userId: string; assignment?: OrderWorkAssignmentData | null; compact?: boolean; taskCount?: number;
  activities?: (OrderWorkAssignmentData & { title: string })[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const involved = assignment?.ownerId === userId || assignment?.collaborators.some((person) => person.userId === userId);
  const otherActivities = activities.filter((task) => task.id !== assignment?.id).map((task) => `${task.title}: ${[task.owner?.name, ...task.collaborators.map((person) => person.user.name)].filter(Boolean).join(", ") || "da assegnare"}`).join(" · ");
  async function claimOrJoin() {
    setBusy(true); setError("");
    try {
      const result = assignment?.ownerId && assignment.ownerId !== userId
        ? await taskParticipationAction(assignment.id, assignment.version, "JOIN")
        : await claimOrderAction(orderId);
      if (!result.ok) setError(result.error);
      router.refresh();
    } catch { setError("Operazione non riuscita. Riprova."); }
    finally { setBusy(false); }
  }
  return <div className={`order-work-assignment${compact ? " is-compact" : ""}`}>
    {assignment?.owner ? <span className="order-work-owner">Segue {assignment.owner.name}
      {assignment.collaborators.length ? ` · con ${assignment.collaborators.map((person) => person.user.name).join(", ")}` : ""}</span>
      : assignment?.collaborators.length ? <span className="order-work-owner">Collaborano {assignment.collaborators.map((person) => person.user.name).join(", ")}</span>
      : taskCount > 0 ? <span className="order-work-owner">{taskCount} {taskCount === 1 ? "incarico collegato" : "incarichi collegati"}</span> : null}
    {otherActivities ? <span className="order-work-activities" title={otherActivities}>{otherActivities}</span> : null}
    <div className="order-work-links">
      {involved ? <Link href={`/my-day?task=${assignment?.id}`} className="order-work-button">Il mio incarico</Link>
        : <button className="order-work-button" type="button" disabled={busy} onClick={claimOrJoin}>
            {busy ? "Salvataggio…" : assignment?.ownerId ? "Collabora" : "Lo seguo io"}
          </button>}
      {!compact ? <Link className="order-work-button secondary-link" href={`/my-day?orderId=${orderId}`}>Aggiungi attività</Link> : null}
    </div>
    {error ? <span role="alert" className="workspace-error">{error}</span> : null}
  </div>;
}
