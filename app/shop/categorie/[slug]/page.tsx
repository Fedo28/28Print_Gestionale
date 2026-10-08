import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getShopHomeCategory } from "@/lib/shop-categories";

export const dynamic = "force-dynamic";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export default function ShopCategoryPage({ params }: { params: { slug: string } }) {
  const category = getShopHomeCategory(params.slug);
  if (!category) {
    notFound();
  }

  return (
    <div className="shop-page-shell shop-category-page">
      <section
        className={`shop-category-hero is-${category.accent}`}
        style={{ backgroundImage: `url(${category.imageSrc})` }}
      >
        <Link className="shop-back-link shop-back-link-icon" href="/shop" aria-label="Torna alla home shop">
          <BackArrowIcon />
        </Link>
        <div>
          <span>Categoria</span>
          <h1>{category.title}</h1>
        </div>
      </section>

      <section className="shop-category-product-grid" aria-label={`Prodotti ${category.title}`}>
        {category.products.map((product) => (
          <Link
            aria-disabled={!product.href}
            className={`shop-category-product-card${product.href ? " is-ready" : " is-muted"}${product.imageSrc ? " is-visual" : ""}${product.secondaryImageSrc ? " has-secondary-image" : ""}`}
            href={product.href || `/shop/categorie/${category.slug}`}
            key={product.label}
          >
            {product.imageSrc ? (
              <span className="shop-category-product-card-media is-primary" aria-hidden="true">
                <Image alt="" fill sizes="(max-width: 760px) 100vw, 360px" src={product.imageSrc} />
              </span>
            ) : null}
            {product.secondaryImageSrc ? (
              <span className="shop-category-product-card-media is-secondary" aria-hidden="true">
                <Image alt="" fill sizes="(max-width: 760px) 50vw, 180px" src={product.secondaryImageSrc} />
              </span>
            ) : null}
            <div>
              <strong>{product.label}</strong>
              {product.note ? <span>{product.note}</span> : null}
            </div>
            <em>{product.href || product.ready ? "Apri" : "In preparazione"}</em>
          </Link>
        ))}
      </section>
    </div>
  );
}
