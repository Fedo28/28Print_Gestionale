import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopRegisterForm } from "@/components/shop-auth-forms";
import { getCustomerAccountSession } from "@/lib/customer-account-auth";
import { getCustomerAccountHealth } from "@/lib/customer-accounts";

export const dynamic = "force-dynamic";

export default async function ShopAccountRegisterPage() {
  if (getCustomerAccountSession()) {
    redirect("/shop/account");
  }

  const health = await getCustomerAccountHealth();

  return (
    <div className="shop-auth-shell">
      <section className="card card-pad auth-card shop-auth-card">
        <div className="stack">
          <div>
            <span className="pill">Primo onboarding cliente</span>
            <h2>Crea il tuo account 28Print</h2>
            <p className="hint">Ogni account cliente e collegato alla stessa anagrafica usata dal gestionale.</p>
          </div>
          <ShopRegisterForm healthMessage={health.ready ? undefined : health.message} />
          <div className="button-row">
            <Link className="button ghost" href="/shop/account/login">
              Ho gia un account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
