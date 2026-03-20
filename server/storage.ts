import { db } from "./db";
import {
  customers,
  appliances,
  serviceOrders,
  payments,
  cashClosings,
  systemSettings,
  type Customer,
  type InsertCustomer,
  type Appliance,
  type InsertAppliance,
  type ServiceOrder,
  type InsertServiceOrder,
  type Payment,
  type InsertPayment,
  type CashClosing,
  type InsertCashClosing,
  type SystemSettings,
  type InsertSystemSettings
} from "@shared/schema";

import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;

  getAppliancesByCustomerId(customerId: number): Promise<Appliance[]>;
  createAppliance(appliance: InsertAppliance): Promise<Appliance>;

  getServiceOrders(): Promise<(ServiceOrder & { customer: Customer, appliance: Appliance })[]>;
  getServiceOrder(id: number): Promise<(ServiceOrder & { customer: Customer, appliance: Appliance }) | undefined>;
  getServiceOrderByToken(token: string): Promise<(ServiceOrder & { customer: Customer, appliance: Appliance }) | undefined>;

  createServiceOrder(order: InsertServiceOrder): Promise<ServiceOrder>;
  updateServiceOrder(id: number, order: Partial<InsertServiceOrder>): Promise<ServiceOrder | undefined>;

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

  async getServiceOrders() {
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

    return rows.map((row) => ({
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
    }));
  }

  async getServiceOrder(id: number) {

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

    return {
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
    };
  }

  async getServiceOrderByToken(token: string) {

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

    return {
      ...row.serviceOrder,
      customer: row.customer,
      appliance: row.appliance,
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

  async createServiceOrder(insertOrder: InsertServiceOrder): Promise<ServiceOrder> {

    const trackingToken = this.generateTrackingToken();

    const orderNumber = await this.getNextOrderNumber();

    const [order] = await db
      .insert(serviceOrders)
      .values({
        ...insertOrder,
        orderNumber,
        trackingToken,
      })
      .returning();

    return order;
  }

  async updateServiceOrder(id: number, updateData: Partial<InsertServiceOrder>) {

    const [order] = await db
      .update(serviceOrders)
      .set(updateData)
      .where(eq(serviceOrders.id, id))
      .returning();

    return order;
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
