export type ShopCategoryProduct = {
  label: string;
  note?: string;
  ready?: boolean;
};

export type ShopHomeCategory = {
  accent: "cyan" | "lime" | "red";
  imageSrc: string;
  products: ShopCategoryProduct[];
  slug: string;
  title: string;
};

export const shopHomeCategories: ShopHomeCategory[] = [
  {
    accent: "cyan",
    imageSrc: "/shop/category-business-mockup.svg",
    products: [
      { label: "Biglietti da visita", note: "Formato, carta, quantità" },
      { label: "Volantini e locandine", note: "A6, A5, A4, A3" },
      { label: "Roll-up", note: "Completo o solo stampa" },
      { label: "Banner e striscioni", note: "Misure e finiture" },
      { label: "Timbri", note: "Testo e dimensioni" },
      { label: "Adesivi e vetrofanie", note: "Piccolo e grande formato" },
      { label: "Etichette adesive", note: "Prodotti, pacchi e negozi" }
    ],
    slug: "per-la-tua-attivita",
    title: "Per la tua attività"
  },
  {
    accent: "lime",
    imageSrc: "/shop/category-photo-mockup.svg",
    products: [
      { label: "Stampa foto", note: "Piccolo formato" },
      { label: "Poster fotografici", note: "Medio e grande formato" },
      { label: "Canvas e tele", note: "Con o senza telaio" },
      { label: "Quadri e pannelli", note: "Supporti rigidi" },
      { label: "Tableau e cerimonie", note: "Formati speciali" }
    ],
    slug: "foto-e-quadri",
    title: "Foto e quadri"
  },
  {
    accent: "red",
    imageSrc: "/shop/category-gadget-mockup.svg",
    products: [
      { label: "T-shirt personalizzate", note: "Singole o per aziende" },
      { label: "Abbigliamento da lavoro", note: "Quantità e loghi" },
      { label: "Tazze", note: "Foto, scritte e grafiche" },
      { label: "Borracce", note: "Colori e personalizzazione" },
      { label: "Etichette adesive", note: "Per packaging e gadget" },
      { label: "Shopper e cappellini", note: "Gadget coordinati" },
      { label: "Portachiavi", note: "Oggettistica rapida" }
    ],
    slug: "magliette-e-gadget",
    title: "Magliette e gadget"
  }
];

export function listShopHomeCategories() {
  return shopHomeCategories;
}

export function getShopHomeCategory(slug: string) {
  return shopHomeCategories.find((category) => category.slug === slug) || null;
}
