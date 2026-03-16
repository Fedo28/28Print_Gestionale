import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-stage">
      <section className="card card-pad auth-card">
        <h2>Elemento non trovato</h2>
        <p className="card-muted">La risorsa richiesta non esiste oppure e stata rimossa.</p>
        <div className="button-row">
          <Link className="button primary" href="/">
            Dashboard
          </Link>
          <Link className="button ghost" href="/orders">
            Ordini
          </Link>
        </div>
      </section>
    </div>
  );
}
