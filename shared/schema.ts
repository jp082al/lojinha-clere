import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// === CUSTOMERS ===
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// === APPLIANCES ===
export const appliances = pgTable("appliances", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  type: text("type").notNull(), // Fridge, washer, etc.
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApplianceSchema = createInsertSchema(appliances).omit({ id: true, createdAt: true });

export type Appliance = typeof appliances.$inferSelect;
export type InsertAppliance = z.infer<typeof insertApplianceSchema>;

// === SERVICE ORDERS ===
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number"),
  customerId: integer("customer_id").notNull(),
  applianceId: integer("appliance_id").notNull(),
  defect: text("defect").notNull(),
  diagnosis: text("diagnosis"),
  status: text("status").notNull().default("Recebido"), // Recebido, Em análise, Aguardando peça, Em reparo, Pronto, Entregue
  serviceValue: numeric("service_value").default("0"),
  partsValue: numeric("parts_value").default("0"),
  totalValue: numeric("total_value").default("0"),
  partsDescription: text("parts_description"),
  paymentMethod: text("payment_method"),
  warrantyDays: integer("warranty_days").default(90),
  entryDate: timestamp("entry_date").defaultNow(),
  exitDate: timestamp("exit_date"),
  trackingToken: text("tracking_token"),
  finalStatus: text("final_status"),
  finalizedBy: text("finalized_by"),
  deliveredTo: text("delivered_to"),
  finalNotes: text("final_notes"),
  // Budget (Orçamento) fields
  budgetStatus: text("budget_status"), // null, AGUARDANDO_APROVACAO, APROVADO, RECUSADO
  budgetValidityDays: integer("budget_validity_days").default(7),
  budgetNotes: text("budget_notes"),
  budgetSentAt: timestamp("budget_sent_at"),
  budgetApprovedAt: timestamp("budget_approved_at"),
  budgetApprovedBy: text("budget_approved_by"),
});

export const serviceOrderPickupWarnings = pgTable("service_order_pickup_warnings", {
  id: serial("id").primaryKey(),
  serviceOrderId: integer("service_order_id").notNull().unique().references(() => serviceOrders.id, { onDelete: "cascade" }),
  warningSentAt: timestamp("warning_sent_at").notNull(),
  warningDeadlineAt: timestamp("warning_deadline_at").notNull(),
  warningStatus: text("warning_status").notNull().default("SENT"),
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrders, {
  exitDate: z.coerce.date().nullable().optional(),
  budgetSentAt: z.coerce.date().nullable().optional(),
  budgetApprovedAt: z.coerce.date().nullable().optional(),
}).omit({ id: true, orderNumber: true, entryDate: true });

export const insertServiceOrderPickupWarningSchema = createInsertSchema(serviceOrderPickupWarnings, {
  warningSentAt: z.coerce.date(),
  warningDeadlineAt: z.coerce.date(),
}).omit({ id: true });

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrderPickupWarning = typeof serviceOrderPickupWarnings.$inferSelect;
export type InsertServiceOrderPickupWarning = z.infer<typeof insertServiceOrderPickupWarningSchema>;


// === PAYMENTS ===
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  amount: numeric("amount").notNull(),
  method: text("method").notNull(), // DINHEIRO, PIX, CARTAO, OUTRO
  receivedBy: text("received_by").notNull(),
  receivedAt: timestamp("received_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, receivedAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// === CASH CLOSINGS ===
export const cashClosings = pgTable("cash_closings", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  closedBy: text("closed_by").notNull(),
  expectedTotal: numeric("expected_total").notNull(),
  countedTotal: numeric("counted_total").notNull(),
  difference: numeric("difference").notNull(),
  notes: text("notes"),
  closedAt: timestamp("closed_at").defaultNow(),
});

export const insertCashClosingSchema = createInsertSchema(cashClosings).omit({ id: true, closedAt: true });
export type CashClosing = typeof cashClosings.$inferSelect;
export type InsertCashClosing = z.infer<typeof insertCashClosingSchema>;

// === SYSTEM SETTINGS ===
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull().default("TechRepair"),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  documentNumber: text("document_number").notNull().default(""),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true });
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

// === RELATIONS ===
export const customersRelations = relations(customers, ({ many }) => ({
  appliances: many(appliances),
  serviceOrders: many(serviceOrders),
}));

export const serviceOrdersRelations = relations(serviceOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceOrders.customerId],
    references: [customers.id],
  }),
  appliance: one(appliances, {
    fields: [serviceOrders.applianceId],
    references: [appliances.id],
  }),
  payments: many(payments),
  pickupWarning: one(serviceOrderPickupWarnings, {
    fields: [serviceOrders.id],
    references: [serviceOrderPickupWarnings.serviceOrderId],
  }),
}));

export const serviceOrderPickupWarningsRelations = relations(serviceOrderPickupWarnings, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [serviceOrderPickupWarnings.serviceOrderId],
    references: [serviceOrders.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [payments.orderId],
    references: [serviceOrders.id],
  }),
}));
