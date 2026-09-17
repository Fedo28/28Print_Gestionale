import { ShopServicePreview } from "@/components/shop-service-preview";
import { ShopCatalogProductConfigurator } from "@/components/shop-catalog-product-configurator";
import { getShopServicePreviewCandidate } from "@/lib/shop-catalog";
import { getShopCatalogProductPage } from "@/lib/shop-product-pages";
import Link from "next/link";

export const dynamic = "force-dynamic";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export default async function ShopServicePage({
  params
}: {
  params: { slug: string };
}) {
  const catalogProductPage = await getShopCatalogProductPage(params.slug);
  if (catalogProductPage) {
    return (
      <div className="shop-page-shell shop-business-card-page">
        <section className={`shop-service-title-strip shop-business-card-hero is-${catalogProductPage.accent}`}>
          <Link className="shop-back-link shop-back-link-icon" href="/shop" aria-label="Torna alla home shop">
            <BackArrowIcon />
          </Link>
          <div>
            <h1>{catalogProductPage.title}</h1>
          </div>
        </section>

        <ShopCatalogProductConfigurator page={catalogProductPage} />
      </div>
    );
  }

  const service = await getShopServicePreviewCandidate(params.slug);

  return <ShopServicePreview expectedSlug={params.slug} quantity={1} service={service} title={service?.name || "Servizio shop"} />;
}
