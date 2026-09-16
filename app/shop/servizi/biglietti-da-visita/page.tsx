import Link from "next/link";
import { ShopBusinessCardConfigurator } from "@/components/shop-business-card-configurator";
import { getBusinessCardShopOptions } from "@/lib/shop-business-cards";

export const dynamic = "force-dynamic";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export default async function ShopBusinessCardsPage() {
  const options = await getBusinessCardShopOptions();

  return (
    <div className="shop-page-shell shop-business-card-page">
      <section className="shop-service-title-strip shop-business-card-hero">
        <Link className="shop-back-link shop-back-link-icon" href="/shop" aria-label="Torna alla home shop">
          <BackArrowIcon />
        </Link>
        <div>
          <h1>Biglietti da visita</h1>
        </div>
      </section>

      <ShopBusinessCardConfigurator options={options} />
    </div>
  );
}
