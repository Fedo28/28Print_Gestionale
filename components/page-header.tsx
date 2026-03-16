import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <span className="page-kicker">Gestionale operativo</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="page-head-action">{action}</div> : null}
    </header>
  );
}
