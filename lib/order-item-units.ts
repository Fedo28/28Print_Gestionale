import { formatQuantity } from "@/lib/format";
import { inferServiceUnitFromCatalogText, type ServiceUnitValue } from "@/lib/service-units";

export type OrderItemMeasurementUnit = "mq" | "ml";

type OrderItemMeasurementCandidate = {
  label?: string | null;
  material?: string | null;
  format?: string | null;
  notes?: string | null;
  serviceCatalog?: {
    code?: string | null;
    name?: string | null;
    description?: string | null;
    unit?: ServiceUnitValue | null;
  } | null;
};

export function getOrderItemMeasurementUnit(item: OrderItemMeasurementCandidate): OrderItemMeasurementUnit | null {
  if (item.serviceCatalog?.unit === "MQ") {
    return "mq";
  }

  if (item.serviceCatalog?.unit === "ML") {
    return "ml";
  }

  const inferredUnit = inferServiceUnitFromCatalogText(
    item.serviceCatalog?.code,
    item.serviceCatalog?.name,
    item.serviceCatalog?.description,
    item.label,
    item.material,
    item.format,
    item.notes
  );

  if (inferredUnit === "MQ") {
    return "mq";
  }

  if (inferredUnit === "ML") {
    return "ml";
  }

  return null;
}

export function formatOrderItemQuantity(value: number, item: OrderItemMeasurementCandidate) {
  const unit = getOrderItemMeasurementUnit(item);
  const quantity = formatQuantity(value);

  return unit ? `${quantity} ${unit}` : quantity;
}
