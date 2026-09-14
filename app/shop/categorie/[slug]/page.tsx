import Link from "next/link";
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
          <article className="shop-category-product-card" key={product.label}>
            <div>
              <strong>{product.label}</strong>
              {product.note ? <span>{product.note}</span> : null}
            </div>
            <em>{product.ready ? "Apri" : "In preparazione"}</em>
          </article>
        ))}
      </section>
    </div>
  );
}
