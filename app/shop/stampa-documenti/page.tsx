import { ShopServicePreview } from "@/components/shop-service-preview";
import { getShopServicePreviewCandidate } from "@/lib/shop-catalog";

export const dynamic = "force-dynamic";

export default async function ShopDocumentPrintPage() {
  const service = await getShopServicePreviewCandidate("stampa-documenti");

  return <ShopServicePreview expectedSlug="stampa-documenti" quantity={1} service={service} title="Stampa documenti" />;
}
