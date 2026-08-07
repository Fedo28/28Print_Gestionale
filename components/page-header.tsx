import type { ReactNode } from "react";

export function PageHeader({
  title,
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
        <div className="page-head-title-row">
          <h2>{title}</h2>
          {titleAction ? <div className="page-head-title-action">{titleAction}</div> : null}
        </div>
      </div>
      {action ? <div className="page-head-action">{action}</div> : null}
    </header>
  );
}
