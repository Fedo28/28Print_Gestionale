export default function Loading() {
  return (
    <div className="stack">
      <section className="page-head loading-shell">
        <div className="page-head-copy">
          <span className="page-kicker">Gestionale operativo</span>
          <div className="loading-block loading-title" />
          <div className="loading-block loading-copy" />
        </div>
        <div className="loading-block loading-action" />
      </section>

      <section className="card card-pad loading-shell">
        <div className="grid loading-summary-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="loading-card" key={index}>
              <div className="loading-block loading-chip" />
              <div className="loading-block loading-stat" />
              <div className="loading-block loading-copy-short" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid loading-main-grid">
        <div className="card card-pad loading-shell">
          <div className="loading-lane">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="loading-list-item" key={index}>
                <div className="loading-block loading-line-strong" />
                <div className="loading-block loading-line" />
                <div className="loading-block loading-line-short" />
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad loading-shell">
          <div className="loading-lane">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="loading-list-item" key={index}>
                <div className="loading-block loading-line-strong" />
                <div className="loading-block loading-line" />
                <div className="loading-block loading-line-short" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
