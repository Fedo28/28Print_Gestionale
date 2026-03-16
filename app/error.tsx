"use client";

import Link from "next/link";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="center-stage">
      <section className="card card-pad auth-card">
        <h2>Si e verificato un errore</h2>
        <p className="card-muted">{error.message || "Operazione non completata."}</p>
        <div className="button-row">
          <button className="primary" onClick={reset} type="button">
            Riprova
          </button>
          <Link className="button ghost" href="/">
            Torna alla dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
