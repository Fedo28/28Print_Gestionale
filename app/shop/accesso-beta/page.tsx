import Link from "next/link";

export default function ShopBetaAccessPage() {
  return (
    <div className="shop-page-shell">
      <section className="shop-card">
        <span className="shop-kicker">Beta attiva</span>
        <div className="shop-config-page-head">
          <h1>Accesso confermato</h1>
          <p className="subtle">Puoi continuare a navigare la bozza controllata dello shop.</p>
        </div>
        <div className="button-row">
          <Link className="button primary" href="/shop">
            Vai allo shop
          </Link>
        </div>
      </section>
    </div>
  );
}
