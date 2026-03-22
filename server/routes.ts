import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, authStorage, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth setup MUST be first
  await setupAuth(app);
  registerAuthRoutes(app);

  // Customers
  app.get(api.customers.list.path, isAuthenticated, async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.get(api.customers.get.path, isAuthenticated, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  });

  app.post(api.customers.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.customers.create.input.parse(req.body);
      const customer = await storage.createCustomer(input);
      res.status(201).json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.customers.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.customers.update.input.parse(req.body);
      const customer = await storage.updateCustomer(Number(req.params.id), input);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      res.json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Appliances
  app.get(api.appliances.list.path, isAuthenticated, async (req, res) => {
    const appliances = await storage.getAppliancesByCustomerId(Number(req.params.customerId));
    res.json(appliances);
  });

  app.post(api.appliances.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.appliances.create.input.parse(req.body);
      const appliance = await storage.createAppliance(input);
      res.status(201).json(appliance);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Service Orders
  app.get(api.serviceOrders.list.path, isAuthenticated, async (req, res) => {
    const orders = await storage.getServiceOrders();
    res.json(orders);
  });

  app.get(api.serviceOrders.pickupWarnings.path, isAuthenticated, async (req, res) => {
    const orders = await storage.getPickupWarningOrders();
    res.json(orders);
  });

  app.post(api.serviceOrders.createPickupWarning.path, isAuthenticated, async (req, res) => {
    try {
      api.serviceOrders.createPickupWarning.input.parse(req.body ?? {});
      const result = await storage.createPickupWarning(Number(req.params.id));

      if (result.kind === "not_found") {
        return res.status(404).json({ message: "Order not found" });
      }

      if (result.kind === "not_eligible") {
        return res.status(400).json({ message: "Order is not eligible for pickup warning" });
      }

      res.json(result.warning);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.serviceOrders.get.path, isAuthenticated, async (req, res) => {
    const order = await storage.getServiceOrder(Number(req.params.id));
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  });

  app.post(api.serviceOrders.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.serviceOrders.create.input.parse(req.body);
      const order = await storage.createServiceOrder({
        ...input,
        createdBy: req.user!.username,
      });
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.serviceOrders.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.serviceOrders.update.input.parse(req.body);
      const isFinalizationUpdate =
        input.finalStatus !== undefined ||
        input.exitDate !== undefined ||
        input.status === "Entregue";
      const order = await storage.updateServiceOrder(Number(req.params.id), {
        ...input,
        ...(isFinalizationUpdate ? { finalizedBy: req.user!.username } : {}),
      });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Payments
  app.get("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const payments = await storage.getPaymentsByDate(date);
    res.json(payments);
  });

  app.post("/api/payments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payment = await storage.createPayment({
      ...req.body,
      receivedBy: req.user!.username
    });
    res.status(201).json(payment);
  });

  app.patch("/api/payments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user!.role !== 'ADMIN') return res.sendStatus(403);
    const id = parseInt(req.params.id);
    const payment = await storage.updatePayment(id, req.body);
    if (!payment) return res.sendStatus(404);
    res.json(payment);
  });

  // Cash Closings
  app.get("/api/cash-closings/:date", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const closing = await storage.getCashClosingByDate(req.params.date);
    res.json(closing || null);
  });

  app.post("/api/cash-closings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const closing = await storage.createCashClosing({
      ...req.body,
      closedBy: req.user!.username
    });
    res.status(201).json(closing);
  });

  // System Settings
  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSystemSettings();
    res.json(settings);
  });

  app.patch("/api/settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'ADMIN') {
      return res.sendStatus(403);
    }
    const settings = await storage.updateSystemSettings(req.body);
    res.json(settings);
  });

  // Stats
  app.get(api.stats.get.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // Public tracking (no auth required)
  app.get('/api/tracking/:token', async (req, res) => {
    const order = await storage.getServiceOrderByToken(req.params.token);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      entryDate: order.entryDate,
      exitDate: order.exitDate,
      defect: order.defect,
      diagnosis: order.diagnosis,
      finalStatus: order.finalStatus,
      appliance: {
        type: order.appliance.type,
        brand: order.appliance.brand,
        model: order.appliance.model
      },
      customer: {
        name: order.customer.name.split(' ')[0]
      }
    });
  });

  // Seeding
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  // Seed initial admin user only when explicit credentials are provided.
  const existingAdmin = await authStorage.getUserByUsername("admin");
  const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME;
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!existingAdmin && initialAdminUsername && initialAdminPassword) {
    await authStorage.createLocalUser({
      firstName: "Administrador",
      lastName: "",
      username: initialAdminUsername,
      password: initialAdminPassword,
      role: "ADMIN"
    });
    console.log(`Initial admin user created: ${initialAdminUsername}`);
  }

  const existingCustomers = await storage.getCustomers();
  if (existingCustomers.length === 0) {
    const customer = await storage.createCustomer({
      name: "João da Silva",
      phone: "11999999999",
      address: "Rua das Flores, 123",
      notes: "Cliente antigo",
    });

    const appliance = await storage.createAppliance({
      customerId: customer.id,
      type: "Geladeira",
      brand: "Brastemp",
      model: "BRM50",
      serialNumber: "123456789",
    });

    await storage.createServiceOrder({
      customerId: customer.id,
      applianceId: appliance.id,
      defect: "Não gela",
      diagnosis: "Falta de gás",
      status: "Em reparo",
      serviceValue: "150.00",
      partsValue: "50.00",
      totalValue: "200.00",
    });

    // Add more seed data
    const customer2 = await storage.createCustomer({
      name: "Maria Oliveira",
      phone: "11988888888",
      address: "Av. Paulista, 1000",
      notes: "",
    });

    const appliance2 = await storage.createAppliance({
      customerId: customer2.id,
      type: "Micro-ondas",
      brand: "Electrolux",
      model: "MEF41",
      serialNumber: "987654321",
    });

    await storage.createServiceOrder({
      customerId: customer2.id,
      applianceId: appliance2.id,
      defect: "Não liga",
      diagnosis: "Fusível queimado",
      status: "Pronto",
      serviceValue: "80.00",
      partsValue: "10.00",
      totalValue: "90.00",
    });
  }
}
