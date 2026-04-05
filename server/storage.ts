import { db } from "./db";
import {
  customers,
  appliances,
  serviceOrders,
  serviceOrderItems,
  serviceOrderDeliveryBatches,
  serviceOrderDeliveryBatchItems,
  serviceOrderPickupWarnings,
  payments,
  cashClosings,
  systemSettings,
  type Customer,
  type InsertCustomer,
  type Appliance,
  type InsertAppliance,
  type ServiceOrder,
  type InsertServiceOrder,
  type ServiceOrderItem,
  type InsertServiceOrderItem,
  type ServiceOrderItemView,
  type ServiceOrderDeliveryBatch,
  type ServiceOrderDeliveryBatchItem,
  type ServiceOrderDeliveryBatchWithItems,
  type ServiceOrderWithRelations,
  type ServiceOrderPickupWarning,
  type Payment,
  type InsertPayment,
  type CashClosing,
  type InsertCashClosing,
  type SystemSettings,
  type InsertSystemSettings
} from "@shared/schema";
import type { CreateServiceOrderInput, UpdateServiceOrderInput } from "@shared/routes";

import { eq, desc, and, gte, lte, sql, inArray, asc } from "drizzle-orm";

export interface IStorage {

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  getAppliancesByCustomerId(customerId: number): Promise<Appliance[]>;
  createAppliance(appliance: InsertAppliance): Promise<Appliance>;

  getServiceOrders(): Promise<ServiceOrderWithRelations[]>;
  getServiceOrder(id: number): Promise<ServiceOrderWithRelations | undefined>;
  getServiceOrderByToken(token: string): Promise<ServiceOrderWithRelations | undefined>;
  getServiceOrderDeliveryBatches(orderId: number): Promise<ServiceOrderDeliveryBatchWithItems[]>;
  getServiceOrderDeliveryBatch(orderId: number, batchId: number): Promise<ServiceOrderDeliveryBatchWithItems | undefined>;
  getPickupWarningOrders(): Promise<Array<{
    id: number;
    orderNumber: string | null;
    status: string;
    entryDate: Date | null;
    daysPending: number;
    customer: {
      id: number;
      name: string;
      phone: string;
    };
    appliance: {
      id: number;
      type: string;
      brand: string;
      model: string;
    };
    pickupWarning: {
      id: number;
      serviceOrderId: number;
      warningSentAt: Date;
      warningDeadlineAt: Date;
      warningStatus: string;
      isExpired: boolean;
    } | null;
  }>>;
  createPickupWarning(id: number): Promise<
    | { kind: "not_found" }
    | { kind: "not_eligible" }
    | {
      kind: "ok";
      warning: {
        id: number;
        serviceOrderId: number;
        warningSentAt: Date;
        warningDeadlineAt: Date;
        warningStatus: string;
        isExpired: boolean;
      };
    }
  >;

  createServiceOrder(order: CreateServiceOrderInput): Promise<ServiceOrder>;
  updateServiceOrder(id: number, order: UpdateServiceOrderInput): Promise<ServiceOrder | undefined>;

  getPaymentsByDate(date: string): Promise<Payment[]>;
  getPaymentsByOrderId(orderId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;

  getCashClosingByDate(date: string): Promise<CashClosing | undefined>;
  createCashClosing(closing: InsertCashClosing): Promise<CashClosing>;

  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings>;

  getStats(): Promise<{
    totalOrders: number;
    completedOrders: number;
    totalRevenue: number;
    statusDistribution: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  private normalizeMoneyValue(value: string | number | null | undefined): string {
    const numericValue = Number(value ?? 0);

    if (!Number.isFinite(numericValue)) {
      return "0.00";
    }

    return numericValue.toFixed(2);
  }

  private isItemFinalized(item: Pick<ServiceOrderItem, "status" | "finalStatus">): boolean {
    return Boolean(item.finalStatus) || item.status === "Entregue";
  }

  private getAggregateOrderStatus(items: Array<Pick<ServiceOrderItem, "status" | "finalStatus">>): string {
    const openItems = items.filter((item) => !this.isItemFinalized(item));
    const statuses = openItems.map((item) => item.status).filter(Boolean);

    if (!openItems.length) {
      return items.every((item) => item.finalStatus === "ENTREGUE") ? "Entregue" : "Pronto";
    }

    if (statuses.every((status) => status === "Pronto")) {
      return "Pronto";
    }

    if (statuses.some((status) => status === "Em reparo")) {
      return "Em reparo";
    }

    if (statuses.some((status) => status === "Aguardando peça")) {
      return "Aguardando peça";
    }

    if (statuses.some((status) => status === "Em análise")) {
      return "Em análise";
    }

    if (statuses.every((status) => status === "Recebido")) {
      return "Recebido";
    }

    return "Em análise";
  }

  private getAggregateOrderFinalization(items: Array<Pick<ServiceOrderItem, "finalStatus" | "exitDate" | "deliveredTo" | "finalNotes" | "finalizedBy">>) {
    if (!items.length || items.some((item) => !item.finalStatus)) {
      return {
        finalStatus: null,
        exitDate: null,
        deliveredTo: null,
        finalNotes: null,
        finalizedBy: null,
      };
    }

    const finalStatuses = Array.from(new Set(items.map((item) => item.finalStatus).filter(Boolean)));
    const deliveredToValues = Array.from(new Set(items.map((item) => item.deliveredTo).filter(Boolean)));
    const finalNotesValues = Array.from(new Set(items.map((item) => item.finalNotes).filter(Boolean)));
    const finalizedByValues = items
      .map((item) => item.finalizedBy)
      .filter((value): value is string => Boolean(value));
    const exitDates = items
      .map((item) => item.exitDate)
      .filter((value): value is Date => value instanceof Date);

    return {
      finalStatus: finalStatuses.length === 1 ? finalStatuses[0] : null,
      exitDate: exitDates.length ? new Date(Math.max(...exitDates.map((date) => date.getTime()))) : null,
      deliveredTo: deliveredToValues.length === 1 ? deliveredToValues[0] : null,
      finalNotes: finalNotesValues.length === 1 ? finalNotesValues[0] : null,
      finalizedBy: finalizedByValues[finalizedByValues.length - 1] ?? null,
    };
  }

  private getAggregatePartsDescription(items: Array<Pick<ServiceOrderItem, "itemNumber" | "partsDescription">>): string | null {
    const describedItems = items
      .filter((item) => item.partsDescription?.trim())
      .map((item) => `Item ${item.itemNumber}: ${item.partsDescription!.trim()}`);

    if (!describedItems.length) {
      return null;
    }

    if (describedItems.length === 1) {
      return describedItems[0].replace(/^Item \d+: /, "");
    }

    return describedItems.join("\n");
  }

  private normalizeCreateOrderItems(order: CreateServiceOrderInput): Array<Omit<InsertServiceOrderItem, "serviceOrderId" | "itemNumber" | "createdAt" | "updatedAt">> {
    if (order.items?.length) {
      return order.items.map((item) => ({
        applianceId: item.applianceId,
        defect: item.defect,
        observations: item.observations ?? null,
        diagnosis: item.diagnosis ?? null,
        status: item.status ?? "Recebido",
        serviceValue: item.serviceValue ?? "0",
        partsValue: item.partsValue ?? "0",
        totalValue: item.totalValue ?? "0",
        partsDescription: item.partsDescription ?? null,
        warrantyDays: item.warrantyDays ?? 90,
        exitDate: item.exitDate ?? null,
        finalStatus: item.finalStatus ?? null,
        finalizedBy: item.finalizedBy ?? null,
        deliveredTo: item.deliveredTo ?? null,
        finalNotes: item.finalNotes ?? null,
      }));
    }

    return [{
      applianceId: order.applianceId,
      defect: order.defect,
      observations: order.observations ?? null,
      diagnosis: order.diagnosis ?? null,
      status: order.status,
      serviceValue: order.serviceValue ?? "0",
      partsValue: order.partsValue ?? "0",
      totalValue: order.totalValue ?? "0",
      partsDescription: order.partsDescription ?? null,
      warrantyDays: order.warrantyDays ?? 90,
      exitDate: order.exitDate ?? null,
      finalStatus: order.finalStatus ?? null,
      finalizedBy: order.finalizedBy ?? null,
      deliveredTo: order.deliveredTo ?? null,
      finalNotes: order.finalNotes ?? null,
    }];
  }

  private getUpdatedValue<T extends object, K extends keyof T>(data: Partial<T>, key: K, fallback: T[K]): T[K] {
    return key in data ? data[key] as T[K] : fallback;
  }

  private toPrimaryItemPayload(order: Pick<
    InsertServiceOrder,
    | "applianceId"
    | "defect"
    | "observations"
    | "diagnosis"
    | "status"
    | "serviceValue"
    | "partsValue"
    | "totalValue"
    | "partsDescription"
    | "warrantyDays"
    | "exitDate"
    | "finalStatus"
    | "finalizedBy"
    | "deliveredTo"
    | "finalNotes"
  >): Omit<InsertServiceOrderItem, "serviceOrderId" | "itemNumber"> {
    return {
      applianceId: order.applianceId,
      defect: order.defect,
      observations: order.observations,
      diagnosis: order.diagnosis,
      status: order.status,
      serviceValue: order.serviceValue,
      partsValue: order.partsValue,
      totalValue: order.totalValue,
      partsDescription: order.partsDescription,
      warrantyDays: order.warrantyDays,
      exitDate: order.exitDate,
      finalStatus: order.finalStatus,
      finalizedBy: order.finalizedBy,
      deliveredTo: order.deliveredTo,
      finalNotes: order.finalNotes,
    };
  }

  private buildLegacyCompatibleItem(order: ServiceOrder, appliance?: Appliance | null): ServiceOrderItemView {
    return {
      id: null,
      serviceOrderId: order.id,
      applianceId: order.applianceId,
      itemNumber: 1,
      defect: order.defect,
      observations: order.observations,
      diagnosis: order.diagnosis,
      status: order.status,
      serviceValue: order.serviceValue,
      partsValue: order.partsValue,
      totalValue: order.totalValue,
      partsDescription: order.partsDescription,
      warrantyDays: order.warrantyDays,
      exitDate: order.exitDate,
      finalStatus: order.finalStatus,
      finalizedBy: order.finalizedBy,
      deliveredTo: order.deliveredTo,
      finalNotes: order.finalNotes,
      createdAt: order.entryDate,
      updatedAt: order.entryDate,
      appliance: appliance ?? null,
    };
  }

  private buildLegacyCompatibleDeliveryItem(order: ServiceOrder): Pick<
    ServiceOrderItemView,
    | "id"
    | "serviceOrderId"
    | "applianceId"
    | "itemNumber"
    | "defect"
    | "diagnosis"
    | "partsDescription"
    | "serviceValue"
    | "partsValue"
    | "totalValue"
    | "warrantyDays"
    | "exitDate"
    | "finalizedBy"
    | "deliveredTo"
    | "finalNotes"
  > {
    return {
      id: null,
      serviceOrderId: order.id,
      applianceId: order.applianceId,
      itemNumber: 1,
      defect: order.defect,
      diagnosis: order.diagnosis,
      partsDescription: order.partsDescription,
      serviceValue: order.serviceValue,
      partsValue: order.partsValue,
      totalValue: order.totalValue,
      warrantyDays: order.warrantyDays,
      exitDate: order.exitDate,
      finalizedBy: order.finalizedBy,
      deliveredTo: order.deliveredTo,
      finalNotes: order.finalNotes,
    };
  }

  private async getDeliveryBatchItemsByBatchIds(batchIds: number[]): Promise<Map<number, ServiceOrderDeliveryBatchItem[]>> {
    if (!batchIds.length) {
      return new Map();
    }

    const items = await db
      .select()
      .from(serviceOrderDeliveryBatchItems)
      .where(inArray(serviceOrderDeliveryBatchItems.batchId, batchIds))
      .orderBy(
        asc(serviceOrderDeliveryBatchItems.batchId),
        asc(serviceOrderDeliveryBatchItems.itemNumberSnapshot),
        asc(serviceOrderDeliveryBatchItems.id),
      );

    const itemsByBatchId = new Map<number, ServiceOrderDeliveryBatchItem[]>();

    for (const item of items) {
      const batchItems = itemsByBatchId.get(item.batchId) ?? [];
      batchItems.push(item);
      itemsByBatchId.set(item.batchId, batchItems);
    }

    return itemsByBatchId;
  }

  private async getDeliveryBatchesByServiceOrderId(serviceOrderId: number): Promise<ServiceOrderDeliveryBatchWithItems[]> {
    const batches = await db
      .select()
      .from(serviceOrderDeliveryBatches)
      .where(eq(serviceOrderDeliveryBatches.serviceOrderId, serviceOrderId))
      .orderBy(desc(serviceOrderDeliveryBatches.deliveredAt), desc(serviceOrderDeliveryBatches.id));

    const itemsByBatchId = await this.getDeliveryBatchItemsByBatchIds(batches.map((batch) => batch.id));

    return batches.map((batch) => ({
      ...batch,
      items: itemsByBatchId.get(batch.id) ?? [],
    }));
  }

  private async createDeliveryBatch(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    params: {
      order: ServiceOrder;
      customer: Customer;
      selectedItems: Array<Pick<
        ServiceOrderItemView,
        | "id"
        | "serviceOrderId"
        | "applianceId"
        | "itemNumber"
        | "defect"
        | "diagnosis"
        | "partsDescription"
        | "serviceValue"
        | "partsValue"
        | "totalValue"
        | "warrantyDays"
        | "exitDate"
        | "finalizedBy"
        | "deliveredTo"
        | "finalNotes"
      >>;
      deliveredAt: Date;
      finalizedBy: string;
      deliveredTo?: string | null;
      finalNotes?: string | null;
      paymentMethod?: string | null;
      isPartial: boolean;
    },
  ): Promise<ServiceOrderDeliveryBatch> {
    const applianceIds = Array.from(new Set(params.selectedItems.map((item) => item.applianceId).filter((value): value is number => Number.isInteger(value))));
    const applianceRows = applianceIds.length
      ? await tx.select().from(appliances).where(inArray(appliances.id, applianceIds))
      : [];
    const appliancesById = new Map(applianceRows.map((appliance) => [appliance.id, appliance]));

    const [batch] = await tx
      .insert(serviceOrderDeliveryBatches)
      .values({
        serviceOrderId: params.order.id,
        orderNumberSnapshot: params.order.orderNumber,
        customerNameSnapshot: params.customer.name,
        customerPhoneSnapshot: params.customer.phone,
        customerAddressSnapshot: params.customer.address,
        entryDateSnapshot: params.order.entryDate,
        deliveredAt: params.deliveredAt,
        finalizedBy: params.finalizedBy,
        deliveredTo: params.deliveredTo ?? null,
        finalNotes: params.finalNotes ?? null,
        paymentMethod: params.paymentMethod ?? null,
        isPartial: params.isPartial,
      })
      .returning();

    await tx.insert(serviceOrderDeliveryBatchItems).values(
      params.selectedItems.map((item) => {
        const appliance = item.applianceId ? appliancesById.get(item.applianceId) : null;

        return {
          batchId: batch.id,
          serviceOrderItemId: item.id ?? null,
          applianceId: item.applianceId ?? null,
          itemNumberSnapshot: item.itemNumber,
          applianceTypeSnapshot: appliance?.type ?? "Aparelho",
          applianceBrandSnapshot: appliance?.brand ?? "",
          applianceModelSnapshot: appliance?.model ?? "",
          applianceSerialNumberSnapshot: appliance?.serialNumber ?? null,
          defectSnapshot: item.defect,
          diagnosisSnapshot: item.diagnosis ?? null,
          partsDescriptionSnapshot: item.partsDescription ?? null,
          serviceValueSnapshot: this.normalizeMoneyValue(item.serviceValue),
          partsValueSnapshot: this.normalizeMoneyValue(item.partsValue),
          totalValueSnapshot: this.normalizeMoneyValue(item.totalValue),
          warrantyDaysSnapshot: item.warrantyDays ?? 90,
        };
      }),
    );

    return batch;
  }

  private async getItemsByServiceOrderIds(serviceOrderIds: number[]): Promise<Map<number, ServiceOrderItemView[]>> {
    if (!serviceOrderIds.length) {
      return new Map();
    }

    const rows = await db
      .select({
        item: serviceOrderItems,
        appliance: appliances,
      })
      .from(serviceOrderItems)
      .leftJoin(appliances, eq(serviceOrderItems.applianceId, appliances.id))
      .where(inArray(serviceOrderItems.serviceOrderId, serviceOrderIds))
      .orderBy(asc(serviceOrderItems.serviceOrderId), asc(serviceOrderItems.itemNumber), asc(serviceOrderItems.id));

    const itemsByOrderId = new Map<number, ServiceOrderItemView[]>();

    for (const row of rows) {
      const orderItems = itemsByOrderId.get(row.item.serviceOrderId) ?? [];
      orderItems.push({
        ...row.item,
        appliance: row.appliance,
      });
      itemsByOrderId.set(row.item.serviceOrderId, orderItems);
    }

    return itemsByOrderId;
  }

  // CUSTOMERS

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, updateData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning();

    return customer;
  }

  // APPLIANCES

  async getAppliancesByCustomerId(customerId: number): Promise<Appliance[]> {
    return await db
      .select()
      .from(appliances)
      .where(eq(appliances.customerId, customerId));
  }

  async createAppliance(insertAppliance: InsertAppliance): Promise<Appliance> {
    const [appliance] = await db
      .insert(appliances)
      .values(insertAppliance)
      .returning();

    return appliance;
  }

  // SERVICE ORDERS

  async getServiceOrders(): Promise<ServiceOrderWithRelations[]> {
    const rows = await db
      .select({
        serviceOrder: serviceOrders,
        customer: customers,
        appliance: appliances,
      })
      .from(serviceOrders)
      .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
      .innerJoin(appliances, eq(serviceOrders.applianceId, appliances.id))
      .orderBy(desc(serviceOrders.entryDate));

    const itemsByOrderId = await this.getItemsByServiceOrderIds(rows.map((row) => row.serviceOrder.id));

    return rows.map((row) => ({
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
      items: itemsByOrderId.get(row.serviceOrder.id) ?? [this.buildLegacyCompatibleItem(row.serviceOrder, row.appliance)],
    }));
  }

  async getServiceOrder(id: number): Promise<ServiceOrderWithRelations | undefined> {

    const rows = await db
      .select({
        serviceOrder: serviceOrders,
        customer: customers,
        appliance: appliances,
      })
      .from(serviceOrders)
      .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
      .innerJoin(appliances, eq(serviceOrders.applianceId, appliances.id))
      .where(eq(serviceOrders.id, id));

    if (!rows.length) return undefined;

    const row = rows[0];
    const itemsByOrderId = await this.getItemsByServiceOrderIds([row.serviceOrder.id]);

    return {
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
      items: itemsByOrderId.get(row.serviceOrder.id) ?? [this.buildLegacyCompatibleItem(row.serviceOrder, row.appliance)],
    };
  }

  async getServiceOrderByToken(token: string): Promise<ServiceOrderWithRelations | undefined> {

    const rows = await db
      .select({
        serviceOrder: serviceOrders,
        customer: customers,
        appliance: appliances,
      })
      .from(serviceOrders)
      .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
      .innerJoin(appliances, eq(serviceOrders.applianceId, appliances.id))
      .where(eq(serviceOrders.trackingToken, token));

    if (!rows.length) return undefined;

    const row = rows[0];
    const itemsByOrderId = await this.getItemsByServiceOrderIds([row.serviceOrder.id]);

    return {
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
      items: itemsByOrderId.get(row.serviceOrder.id) ?? [this.buildLegacyCompatibleItem(row.serviceOrder, row.appliance)],
    };
  }

  async getServiceOrderDeliveryBatches(orderId: number): Promise<ServiceOrderDeliveryBatchWithItems[]> {
    const [order] = await db
      .select({ id: serviceOrders.id })
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return [];
    }

    return this.getDeliveryBatchesByServiceOrderId(orderId);
  }

  async getServiceOrderDeliveryBatch(orderId: number, batchId: number): Promise<ServiceOrderDeliveryBatchWithItems | undefined> {
    const [batch] = await db
      .select()
      .from(serviceOrderDeliveryBatches)
      .where(and(
        eq(serviceOrderDeliveryBatches.id, batchId),
        eq(serviceOrderDeliveryBatches.serviceOrderId, orderId),
      ))
      .limit(1);

    if (!batch) {
      return undefined;
    }

    const itemsByBatchId = await this.getDeliveryBatchItemsByBatchIds([batch.id]);

    return {
      ...batch,
      items: itemsByBatchId.get(batch.id) ?? [],
    };
  }

  async getPickupWarningOrders() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const rows = await db
      .select({
        id: serviceOrders.id,
        orderNumber: serviceOrders.orderNumber,
        status: serviceOrders.status,
        entryDate: serviceOrders.entryDate,
        customer: {
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
        },
        appliance: {
        id: appliances.id,
        type: appliances.type,
        brand: appliances.brand,
        model: appliances.model,
      },
      pickupWarning: {
        id: serviceOrderPickupWarnings.id,
        serviceOrderId: serviceOrderPickupWarnings.serviceOrderId,
        warningSentAt: serviceOrderPickupWarnings.warningSentAt,
        warningDeadlineAt: serviceOrderPickupWarnings.warningDeadlineAt,
        warningStatus: serviceOrderPickupWarnings.warningStatus,
      },
    })
    .from(serviceOrders)
    .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
    .innerJoin(appliances, eq(serviceOrders.applianceId, appliances.id))
    .leftJoin(serviceOrderPickupWarnings, eq(serviceOrderPickupWarnings.serviceOrderId, serviceOrders.id))
    .where(and(
      lte(serviceOrders.entryDate, cutoffDate),
      sql`${serviceOrders.exitDate} IS NULL`,
      sql`${serviceOrders.finalStatus} IS NULL`,
      sql`${serviceOrders.status} != 'Entregue'`,
    ))
    .orderBy(serviceOrders.entryDate);

  return rows.map((row) => {
    const entryDate = row.entryDate;
    const daysPending = entryDate
      ? Math.max(0, Math.floor((Date.now() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const pickupWarning = row.pickupWarning && row.pickupWarning.id !== null
      ? {
        id: row.pickupWarning.id,
        serviceOrderId: row.pickupWarning.serviceOrderId,
        warningSentAt: row.pickupWarning.warningSentAt,
        warningDeadlineAt: row.pickupWarning.warningDeadlineAt,
        warningStatus: row.pickupWarning.warningStatus,
        isExpired: row.pickupWarning.warningDeadlineAt.getTime() <= Date.now(),
      }
      : null;

    return {
      ...row,
      daysPending,
      pickupWarning,
    };
  });
}

  async createPickupWarning(id: number) {
    const [existingOrder] = await db
      .select({
        id: serviceOrders.id,
        entryDate: serviceOrders.entryDate,
        exitDate: serviceOrders.exitDate,
        finalStatus: serviceOrders.finalStatus,
        status: serviceOrders.status,
      })
      .from(serviceOrders)
      .where(eq(serviceOrders.id, id));

    if (!existingOrder) {
      return { kind: "not_found" as const };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const isEligible =
      !!existingOrder.entryDate &&
      new Date(existingOrder.entryDate).getTime() <= cutoffDate.getTime() &&
      !existingOrder.exitDate &&
      !existingOrder.finalStatus &&
      existingOrder.status !== "Entregue";

    if (!isEligible) {
      return { kind: "not_eligible" as const };
    }

    const [existingWarning] = await db
      .select()
      .from(serviceOrderPickupWarnings)
      .where(eq(serviceOrderPickupWarnings.serviceOrderId, id));

    if (existingWarning) {
      return {
        kind: "ok" as const,
        warning: {
          id: existingWarning.id,
          serviceOrderId: existingWarning.serviceOrderId,
          warningSentAt: existingWarning.warningSentAt,
          warningDeadlineAt: existingWarning.warningDeadlineAt,
          warningStatus: existingWarning.warningStatus,
          isExpired: existingWarning.warningDeadlineAt.getTime() <= Date.now(),
        },
      };
    }

    const warningSentAt = new Date();
    const warningDeadlineAt = new Date(warningSentAt.getTime() + (48 * 60 * 60 * 1000));

    const [createdWarning] = await db
      .insert(serviceOrderPickupWarnings)
      .values({
        serviceOrderId: id,
        warningSentAt,
        warningDeadlineAt,
        warningStatus: "SENT",
      })
      .returning();

    return {
      kind: "ok" as const,
      warning: {
        id: createdWarning.id,
        serviceOrderId: createdWarning.serviceOrderId,
        warningSentAt: createdWarning.warningSentAt,
        warningDeadlineAt: createdWarning.warningDeadlineAt,
        warningStatus: createdWarning.warningStatus,
        isExpired: createdWarning.warningDeadlineAt.getTime() <= Date.now(),
      },
    };
  }

  private generateTrackingToken(): string {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let token = "";

    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return token;
  }

  // GERAR NUMERO DA OS → OS-ANO-1001

  private async getNextOrderNumber(): Promise<string> {

    const year = new Date().getFullYear();

    const result = await db.execute(sql`
      SELECT order_number
      FROM service_orders
      WHERE order_number LIKE ${`OS-${year}-%`}
      ORDER BY order_number DESC
      LIMIT 1
    `);

    if (!result.rows.length) {
      return `OS-${year}-1001`;
    }

    const last = result.rows[0].order_number as string;

    const lastNumber = parseInt(last.split("-")[2]);

    const next = lastNumber + 1;

    return `OS-${year}-${next}`;
  }

  async createServiceOrder(insertOrder: CreateServiceOrderInput): Promise<ServiceOrder> {
    const trackingToken = this.generateTrackingToken();
    const orderNumber = await this.getNextOrderNumber();
    const normalizedItems = this.normalizeCreateOrderItems(insertOrder);
    const primaryItem = normalizedItems[0];
    const { items: _ignoredItems, ...serviceOrderData } = insertOrder;

    return await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(serviceOrders)
        .values({
          ...serviceOrderData,
          applianceId: primaryItem.applianceId,
          defect: primaryItem.defect,
          observations: primaryItem.observations,
          diagnosis: primaryItem.diagnosis,
          status: primaryItem.status,
          serviceValue: primaryItem.serviceValue,
          partsValue: primaryItem.partsValue,
          totalValue: primaryItem.totalValue,
          partsDescription: primaryItem.partsDescription,
          warrantyDays: primaryItem.warrantyDays,
          exitDate: primaryItem.exitDate,
          finalStatus: primaryItem.finalStatus,
          finalizedBy: primaryItem.finalizedBy,
          deliveredTo: primaryItem.deliveredTo,
          finalNotes: primaryItem.finalNotes,
          orderNumber,
          trackingToken,
        })
        .returning();

      await tx.insert(serviceOrderItems).values(
        normalizedItems.map((item, index) => ({
          serviceOrderId: order.id,
          itemNumber: index + 1,
          ...item,
        }))
      );

      return order;
    });
  }

  async updateServiceOrder(id: number, updateData: UpdateServiceOrderInput) {
    return await db.transaction(async (tx) => {
      const { items: itemUpdates, ...serviceOrderUpdateData } = updateData;
      const hasServiceOrderUpdates = Object.keys(serviceOrderUpdateData).length > 0;
      const [order] = hasServiceOrderUpdates
        ? await tx
          .update(serviceOrders)
          .set(serviceOrderUpdateData)
          .where(eq(serviceOrders.id, id))
          .returning()
        : await tx
          .select()
          .from(serviceOrders)
          .where(eq(serviceOrders.id, id))
          .limit(1);

      if (!order) {
        return undefined;
      }

      const [customerRow] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1);

      const [primaryItem] = await tx
        .select()
        .from(serviceOrderItems)
        .where(eq(serviceOrderItems.serviceOrderId, id))
        .orderBy(asc(serviceOrderItems.itemNumber), asc(serviceOrderItems.id))
        .limit(1);

      if (primaryItem) {
        const itemUpdateData = this.toPrimaryItemPayload({
          applianceId: this.getUpdatedValue(serviceOrderUpdateData, "applianceId", primaryItem.applianceId),
          defect: this.getUpdatedValue(serviceOrderUpdateData, "defect", primaryItem.defect),
          observations: this.getUpdatedValue(serviceOrderUpdateData, "observations", primaryItem.observations),
          diagnosis: this.getUpdatedValue(serviceOrderUpdateData, "diagnosis", primaryItem.diagnosis),
          status: this.getUpdatedValue(serviceOrderUpdateData, "status", primaryItem.status),
          serviceValue: this.getUpdatedValue(serviceOrderUpdateData, "serviceValue", primaryItem.serviceValue),
          partsValue: this.getUpdatedValue(serviceOrderUpdateData, "partsValue", primaryItem.partsValue),
          totalValue: this.getUpdatedValue(serviceOrderUpdateData, "totalValue", primaryItem.totalValue),
          partsDescription: this.getUpdatedValue(serviceOrderUpdateData, "partsDescription", primaryItem.partsDescription),
          warrantyDays: this.getUpdatedValue(serviceOrderUpdateData, "warrantyDays", primaryItem.warrantyDays),
          exitDate: this.getUpdatedValue(serviceOrderUpdateData, "exitDate", primaryItem.exitDate),
          finalStatus: this.getUpdatedValue(serviceOrderUpdateData, "finalStatus", primaryItem.finalStatus),
          finalizedBy: this.getUpdatedValue(serviceOrderUpdateData, "finalizedBy", primaryItem.finalizedBy),
          deliveredTo: this.getUpdatedValue(serviceOrderUpdateData, "deliveredTo", primaryItem.deliveredTo),
          finalNotes: this.getUpdatedValue(serviceOrderUpdateData, "finalNotes", primaryItem.finalNotes),
        });

        await tx
          .update(serviceOrderItems)
          .set(itemUpdateData)
          .where(eq(serviceOrderItems.id, primaryItem.id));
      }

      if (itemUpdates?.length) {
        for (const itemUpdate of itemUpdates) {
          let item: ServiceOrderItem | undefined;

          if (itemUpdate.id) {
            const [foundItem] = await tx
              .select()
              .from(serviceOrderItems)
              .where(eq(serviceOrderItems.id, itemUpdate.id))
              .limit(1);
            item = foundItem;
          } else if (itemUpdate.itemNumber) {
            const [foundItem] = await tx
              .select()
              .from(serviceOrderItems)
              .where(and(
                eq(serviceOrderItems.serviceOrderId, id),
                eq(serviceOrderItems.itemNumber, itemUpdate.itemNumber),
              ))
              .limit(1);
            item = foundItem;
          }

          if (item) {
            const serviceValue = this.normalizeMoneyValue(itemUpdate.serviceValue ?? item.serviceValue);
            const partsValue = this.normalizeMoneyValue(itemUpdate.partsValue ?? item.partsValue);
            const totalValue = this.normalizeMoneyValue(Number(serviceValue) + Number(partsValue));

            await tx
              .update(serviceOrderItems)
              .set({
                diagnosis: itemUpdate.diagnosis ?? item.diagnosis ?? null,
                status: itemUpdate.status ?? item.status,
                serviceValue,
                partsValue,
                totalValue,
                partsDescription: itemUpdate.partsDescription ?? item.partsDescription ?? null,
                warrantyDays: itemUpdate.warrantyDays ?? item.warrantyDays,
                exitDate: itemUpdate.exitDate ?? item.exitDate ?? null,
                finalStatus: itemUpdate.finalStatus ?? item.finalStatus ?? null,
                finalizedBy: itemUpdate.finalizedBy ?? item.finalizedBy ?? null,
                deliveredTo: itemUpdate.deliveredTo ?? item.deliveredTo ?? null,
                finalNotes: itemUpdate.finalNotes ?? item.finalNotes ?? null,
              })
              .where(eq(serviceOrderItems.id, item.id));
          }
        }

        const updatedItems = await tx
          .select()
          .from(serviceOrderItems)
          .where(eq(serviceOrderItems.serviceOrderId, id))
          .orderBy(asc(serviceOrderItems.itemNumber), asc(serviceOrderItems.id));

        const updatedPrimaryItem = updatedItems[0];
        const aggregateFinalization = this.getAggregateOrderFinalization(updatedItems);

        if (updatedPrimaryItem) {
          await tx
            .update(serviceOrders)
            .set({
              diagnosis: updatedPrimaryItem.diagnosis,
              status: this.getAggregateOrderStatus(updatedItems),
              serviceValue: this.normalizeMoneyValue(updatedItems.reduce((sum, item) => sum + Number(item.serviceValue ?? 0), 0)),
              partsValue: this.normalizeMoneyValue(updatedItems.reduce((sum, item) => sum + Number(item.partsValue ?? 0), 0)),
              totalValue: this.normalizeMoneyValue(updatedItems.reduce((sum, item) => sum + Number(item.totalValue ?? 0), 0)),
              partsDescription: this.getAggregatePartsDescription(updatedItems),
              warrantyDays: updatedPrimaryItem.warrantyDays,
              exitDate: aggregateFinalization.exitDate,
              finalStatus: aggregateFinalization.finalStatus,
              deliveredTo: aggregateFinalization.deliveredTo,
              finalNotes: aggregateFinalization.finalNotes,
              finalizedBy: aggregateFinalization.finalizedBy,
            })
            .where(eq(serviceOrders.id, id));
        }
      }

      const hasLegacyFinalizationUpdate =
        serviceOrderUpdateData.finalStatus !== undefined ||
        serviceOrderUpdateData.exitDate !== undefined ||
        serviceOrderUpdateData.status === "Entregue";
      const finalizedItemRefs = (itemUpdates ?? []).filter((itemUpdate) =>
        itemUpdate.finalStatus !== undefined ||
        itemUpdate.exitDate !== undefined ||
        itemUpdate.status === "Entregue",
      );

      if (customerRow && (hasLegacyFinalizationUpdate || finalizedItemRefs.length > 0)) {
        const allItems = await tx
          .select()
          .from(serviceOrderItems)
          .where(eq(serviceOrderItems.serviceOrderId, id))
          .orderBy(asc(serviceOrderItems.itemNumber), asc(serviceOrderItems.id));

        const selectedItems = finalizedItemRefs.length
          ? allItems.filter((item) =>
            finalizedItemRefs.some((ref) =>
              (ref.id && item.id === ref.id) ||
              (ref.itemNumber && item.itemNumber === ref.itemNumber),
            ),
          )
          : (primaryItem
            ? [allItems.find((item) => item.id === primaryItem.id) ?? primaryItem]
            : [this.buildLegacyCompatibleDeliveryItem(order)]);

        if (selectedItems.length) {
          const isPartial = allItems.length
            ? allItems.some((item) => !this.isItemFinalized(item))
            : false;
          const deliveredAt = selectedItems
            .map((item) => item.exitDate)
            .filter((value): value is Date => value instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            ?? (serviceOrderUpdateData.exitDate instanceof Date ? serviceOrderUpdateData.exitDate : new Date());
          const finalizedBy = selectedItems
            .map((item) => item.finalizedBy)
            .filter((value): value is string => Boolean(value))
            .at(-1)
            ?? serviceOrderUpdateData.finalizedBy
            ?? "Usuário";
          const deliveredTo = selectedItems
            .map((item) => item.deliveredTo)
            .filter((value): value is string => Boolean(value));
          const finalNotes = selectedItems
            .map((item) => item.finalNotes)
            .filter((value): value is string => Boolean(value));

          await this.createDeliveryBatch(tx, {
            order,
            customer: customerRow,
            selectedItems,
            deliveredAt,
            finalizedBy,
            deliveredTo: deliveredTo.at(-1) ?? serviceOrderUpdateData.deliveredTo ?? null,
            finalNotes: finalNotes.at(-1) ?? serviceOrderUpdateData.finalNotes ?? null,
            paymentMethod: serviceOrderUpdateData.paymentMethod ?? order.paymentMethod ?? null,
            isPartial,
          });
        }
      }

      return order;
    });
  }

  // PAYMENTS

  async getPaymentsByDate(date: string): Promise<Payment[]> {

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(payments)
      .where(and(gte(payments.receivedAt, start), lte(payments.receivedAt, end)))
      .orderBy(desc(payments.receivedAt));
  }

  async getPaymentsByOrderId(orderId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.orderId, orderId));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {

    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();

    return payment;
  }

  async updatePayment(id: number, updateData: Partial<InsertPayment>) {

    const [payment] = await db
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();

    return payment;
  }

  // CASH

  async getCashClosingByDate(dateStr: string) {

    const [closing] = await db
      .select()
      .from(cashClosings)
      .where(eq(cashClosings.date, dateStr));

    return closing;
  }

  async createCashClosing(insertClosing: InsertCashClosing) {

    const [closing] = await db
      .insert(cashClosings)
      .values(insertClosing)
      .returning();

    return closing;
  }

  // SETTINGS

  async getSystemSettings(): Promise<SystemSettings> {

    const [settings] = await db
      .select()
      .from(systemSettings)
      .limit(1);

    if (!settings) {

      const [newSettings] = await db
        .insert(systemSettings)
        .values({
          businessName: "A Lojinha Clere",
          phone: "(82)99838-2648",
          address: "Rua Brasília, 205",
          documentNumber: ""
        })
        .returning();

      return newSettings;
    }

    return settings;
  }

  async updateSystemSettings(updateData: Partial<InsertSystemSettings>) {

    const [settings] = await db.select().from(systemSettings).limit(1);

    const [updated] = await db
      .update(systemSettings)
      .set(updateData)
      .where(eq(systemSettings.id, settings.id))
      .returning();

    return updated;
  }

  // STATS

  async getStats() {

    const orders = await db.select().from(serviceOrders);

    const totalOrders = orders.length;

    const completedOrders = orders.filter(
      o => o.status === "Entregue" || o.status === "Pronto"
    ).length;

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalValue || 0), 0);

    const statusDistribution: Record<string, number> = {};

    orders.forEach(o => {
      statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
    });

    return {
      totalOrders,
      completedOrders,
      totalRevenue,
      statusDistribution
    };
  }
}

export const storage = new DatabaseStorage();
