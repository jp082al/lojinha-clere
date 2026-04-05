type LegacyOrderLike = {
  appliance?: {
    type?: string | null;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
  } | null;
  defect?: string | null;
  observations?: string | null;
  diagnosis?: string | null;
  partsDescription?: string | null;
  serviceValue?: string | number | null;
  partsValue?: string | number | null;
  totalValue?: string | number | null;
  warrantyDays?: number | null;
  exitDate?: string | Date | null;
  finalStatus?: string | null;
  finalizedBy?: string | null;
  deliveredTo?: string | null;
  finalNotes?: string | null;
  items?: Array<{
    id?: number | null;
    itemNumber?: number | null;
    applianceId?: number | null;
    defect?: string | null;
    observations?: string | null;
    diagnosis?: string | null;
    status?: string | null;
    serviceValue?: string | number | null;
    partsValue?: string | number | null;
    totalValue?: string | number | null;
    partsDescription?: string | null;
    warrantyDays?: number | null;
    exitDate?: string | Date | null;
    finalStatus?: string | null;
    finalizedBy?: string | null;
    deliveredTo?: string | null;
    finalNotes?: string | null;
  }> | null;
};

type ApplianceCatalogEntry = {
  id: number;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
};

export function getOrderItems(order: LegacyOrderLike) {
  if (order.items?.length) {
    return order.items;
  }

  return [{
    id: null,
    itemNumber: 1,
    applianceId: null,
    defect: order.defect ?? null,
    observations: order.observations ?? null,
    diagnosis: order.diagnosis ?? null,
    status: null,
    serviceValue: order.serviceValue ?? null,
    partsValue: order.partsValue ?? null,
    totalValue: order.totalValue ?? null,
    partsDescription: order.partsDescription ?? null,
    warrantyDays: order.warrantyDays ?? null,
    exitDate: order.exitDate ?? null,
    finalStatus: order.finalStatus ?? null,
    finalizedBy: order.finalizedBy ?? null,
    deliveredTo: order.deliveredTo ?? null,
    finalNotes: order.finalNotes ?? null,
  }];
}

export function hasOrderItems(order: LegacyOrderLike) {
  return Boolean(order.items?.length);
}

export function isOrderItemFinalized(item: {
  status?: string | null;
  finalStatus?: string | null;
}) {
  return Boolean(item.finalStatus) || item.status === "Entregue";
}

export function getOrderItemAppliance(order: LegacyOrderLike, item: ReturnType<typeof getOrderItems>[number], appliancesById?: Map<number, ApplianceCatalogEntry>) {
  if (item.applianceId && appliancesById?.has(item.applianceId)) {
    return appliancesById.get(item.applianceId) ?? null;
  }

  return order.appliance ?? null;
}

export function formatApplianceLabel(appliance?: {
  type?: string | null;
  brand?: string | null;
  model?: string | null;
} | null) {
  if (!appliance) return "Aparelho não informado";

  return [appliance.type, appliance.brand, appliance.model].filter(Boolean).join(" ") || "Aparelho não informado";
}

export function getOrderItemsSummary(order: LegacyOrderLike, appliances: ApplianceCatalogEntry[] = []) {
  const items = getOrderItems(order);
  const appliancesById = new Map(appliances.map((appliance) => [appliance.id, appliance]));

  return items.map((item, index) => {
    const appliance = getOrderItemAppliance(order, item, appliancesById);

    return {
      id: item.id ?? null,
      itemNumber: item.itemNumber ?? index + 1,
      appliance,
      applianceLabel: formatApplianceLabel(appliance),
      defect: item.defect ?? order.defect ?? "",
      observations: item.observations ?? order.observations ?? null,
      diagnosis: item.diagnosis ?? order.diagnosis ?? null,
      status: item.status ?? null,
      partsDescription: item.partsDescription ?? order.partsDescription ?? null,
      serviceValue: Number(item.serviceValue ?? 0),
      partsValue: Number(item.partsValue ?? 0),
      totalValue: Number(item.totalValue ?? (Number(item.serviceValue ?? 0) + Number(item.partsValue ?? 0))),
      warrantyDays: item.warrantyDays ?? order.warrantyDays ?? null,
      exitDate: item.exitDate ?? order.exitDate ?? null,
      finalStatus: item.finalStatus ?? order.finalStatus ?? null,
      finalizedBy: item.finalizedBy ?? order.finalizedBy ?? null,
      deliveredTo: item.deliveredTo ?? order.deliveredTo ?? null,
      finalNotes: item.finalNotes ?? order.finalNotes ?? null,
    };
  });
}

export function getOrderSummaryPreview(order: LegacyOrderLike, appliances: ApplianceCatalogEntry[] = []) {
  const items = getOrderItemsSummary(order, appliances);
  const firstItem = items[0];

  if (!firstItem) {
    return {
      itemCount: 0,
      preview: "",
      totalValue: Number(order.totalValue ?? 0),
    };
  }

  const preview = items.length === 1
    ? `${firstItem.applianceLabel} - ${firstItem.defect}`
    : `${firstItem.applianceLabel} - ${firstItem.defect} +${items.length - 1} item(ns)`;

  const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0) || Number(order.totalValue ?? 0);

  return {
    itemCount: items.length,
    preview,
    totalValue,
  };
}
