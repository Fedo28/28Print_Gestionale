import { ShopServicePreview } from "@/components/shop-service-preview";
import { getShopServicePreviewCandidate } from "@/lib/shop-catalog";

export const dynamic = "force-dynamic";

export default async function ShopServicePage({
  params
}: {
  params: { slug: string };
}) {
  const service = await getShopServicePreviewCandidate(params.slug);

  return <ShopServicePreview expectedSlug={params.slug} quantity={1} service={service} title={service?.name || "Servizio shop"} />;
}
