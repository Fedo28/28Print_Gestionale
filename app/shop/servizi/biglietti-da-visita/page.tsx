import Link from "next/link";
import { ShopCatalogProductConfigurator } from "@/components/shop-catalog-product-configurator";
import { getBusinessCardShopOptions, type BusinessCardShopOption } from "@/lib/shop-business-cards";
import { BUSINESS_CARD_PAPER_CHOICES } from "@/lib/shop-catalog-customizations";
import type { ShopCatalogProductPage } from "@/lib/shop-product-pages";

export const dynamic = "force-dynamic";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function isAvailableBusinessCardCatalogOption(
  option: BusinessCardShopOption
): option is BusinessCardShopOption & { id: string } {
  return Boolean(option.available && option.id && option.quantities.length);
}

export default async function ShopBusinessCardsPage() {
  const options = await getBusinessCardShopOptions();
  const page: ShopCatalogProductPage = {
    accent: "cyan",
    imageAlt: "Biglietti da visita stampati",
    imageSrc: "/shop/product-biglietti-visita.jpg",
    options: options
      .filter(isAvailableBusinessCardCatalogOption)
      .map((option) => ({
        code: option.code,
        id: option.id,
        label: option.label,
        quantities: option.quantities
      })),
    paperChoices: BUSINESS_CARD_PAPER_CHOICES,
    slug: "biglietti-da-visita",
    templateLabel: "Template file",
    title: "Biglietti da visita"
  };

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

      <ShopCatalogProductConfigurator page={page} />
    </div>
  );
}
