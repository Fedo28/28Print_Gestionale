import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopLoginForm } from "@/components/shop-auth-forms";
import { getCustomerAccountSession } from "@/lib/customer-account-auth";
import { getCustomerAccountHealth } from "@/lib/customer-accounts";

export const dynamic = "force-dynamic";

export default async function ShopAccountLoginPage() {
  if (getCustomerAccountSession()) {
    redirect("/shop/account");
  }

  const health = await getCustomerAccountHealth();

  return (
    <div className="shop-auth-shell">
      <section className="card card-pad auth-card shop-auth-card">
        <div className="stack">
          <div>
            <span className="pill">Area clienti</span>
            <h2>Accedi allo shop</h2>
            <p className="hint">Login cliente separato dal gestionale interno.</p>
          </div>
          <ShopLoginForm healthMessage={health.ready ? undefined : health.message} />
          <div className="button-row">
            <Link className="button ghost" href="/shop/account/register">
              Crea un account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
