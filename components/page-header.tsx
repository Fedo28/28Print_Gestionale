import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  titleAction
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  titleAction?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <span className="page-kicker">Gestionale operativo</span>
        <div className="page-head-title-row">
          <h2>{title}</h2>
          {titleAction ? <div className="page-head-title-action">{titleAction}</div> : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-head-action">{action}</div> : null}
    </header>
  );
}
