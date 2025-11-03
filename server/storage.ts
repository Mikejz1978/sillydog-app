import {
  type Customer,
  type InsertCustomer,
  type Route,
  type InsertRoute,
  type Invoice,
  type InsertInvoice,
  type JobHistory,
  type InsertJobHistory,
  type Message,
  type InsertMessage,
  type ScheduleRule,
  type InsertScheduleRule,
  type ReminderLog,
  type InsertReminderLog,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;


  // Customers
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Routes
  getAllRoutes(): Promise<Route[]>;
  getRoutesByDate(date: string): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route>;
  updateRouteStatus(id: string, status: string): Promise<Route>;
  deleteRoute(id: string): Promise<void>;

  // Invoices
  getAllInvoices(): Promise<Invoice[]>;
  getInvoicesByCustomer(customerId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  markInvoicePaid(id: string, paymentIntentId: string): Promise<Invoice>;

  // Job History
  getAllJobHistory(): Promise<JobHistory[]>;
  getJobHistoryByCustomer(customerId: string): Promise<JobHistory[]>;
  createJobHistory(history: InsertJobHistory): Promise<JobHistory>;
  updateJobHistory(id: string, history: Partial<InsertJobHistory>): Promise<JobHistory>;

  // Messages
  getAllMessages(): Promise<Message[]>;
  getMessagesByCustomer(customerId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Schedule Rules
  getAllScheduleRules(): Promise<ScheduleRule[]>;
  getScheduleRulesByCustomer(customerId: string): Promise<ScheduleRule[]>;
  createScheduleRule(rule: InsertScheduleRule): Promise<ScheduleRule>;
  updateScheduleRule(id: string, rule: Partial<InsertScheduleRule>): Promise<ScheduleRule>;
  deleteScheduleRule(id: string): Promise<void>;

  // Reminder Logs
  createReminderLog(log: InsertReminderLog): Promise<ReminderLog>;
  getReminderLogsByDate(serviceDate: string): Promise<ReminderLog[]>;
}

export class MemStorage implements IStorage {
  private customers: Map<string, Customer>;
  private routes: Map<string, Route>;
  private invoices: Map<string, Invoice>;
  private jobHistory: Map<string, JobHistory>;

  constructor() {
    this.customers = new Map();
    this.routes = new Map();
    this.invoices = new Map();
    this.jobHistory = new Map();
  }

  // Customers
  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      ...insertCustomer,
      id,
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    const updated = { ...customer, ...updates };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string): Promise<void> {
    this.customers.delete(id);
  }

  // Routes
  async getAllRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }

  async getRoutesByDate(date: string): Promise<Route[]> {
    return Array.from(this.routes.values()).filter((route) => route.date === date);
  }

  async getRoute(id: string): Promise<Route | undefined> {
    return this.routes.get(id);
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const id = randomUUID();
    const route: Route = {
      ...insertRoute,
      id,
      completedAt: null,
      createdAt: new Date(),
    };
    this.routes.set(id, route);
    return route;
  }

  async updateRoute(id: string, updates: Partial<InsertRoute>): Promise<Route> {
    const route = this.routes.get(id);
    if (!route) {
      throw new Error("Route not found");
    }
    const updated = { ...route, ...updates };
    this.routes.set(id, updated);
    return updated;
  }

  async updateRouteStatus(id: string, status: string): Promise<Route> {
    const route = this.routes.get(id);
    if (!route) {
      throw new Error("Route not found");
    }
    const updated = {
      ...route,
      status,
      completedAt: status === "completed" ? new Date() : route.completedAt,
    };
    this.routes.set(id, updated);
    return updated;
  }

  async deleteRoute(id: string): Promise<void> {
    this.routes.delete(id);
  }

  // Invoices
  async getAllInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (invoice) => invoice.customerId === customerId
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoice: Invoice = {
      ...insertInvoice,
      id,
      paidAt: null,
      stripePaymentIntentId: null,
      createdAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    const updated = { ...invoice, ...updates };
    this.invoices.set(id, updated);
    return updated;
  }

  async markInvoicePaid(id: string, paymentIntentId: string): Promise<Invoice> {
    const invoice = this.invoices.get(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    const updated = {
      ...invoice,
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    };
    this.invoices.set(id, updated);
    return updated;
  }

  // Job History
  async getAllJobHistory(): Promise<JobHistory[]> {
    return Array.from(this.jobHistory.values());
  }

  async getJobHistoryByCustomer(customerId: string): Promise<JobHistory[]> {
    return Array.from(this.jobHistory.values()).filter(
      (history) => history.customerId === customerId
    );
  }

  async createJobHistory(insertHistory: InsertJobHistory): Promise<JobHistory> {
    const id = randomUUID();
    const history: JobHistory = {
      ...insertHistory,
      id,
      createdAt: new Date(),
    };
    this.jobHistory.set(id, history);
    return history;
  }

  async updateJobHistory(
    id: string,
    updates: Partial<InsertJobHistory>
  ): Promise<JobHistory> {
    const history = this.jobHistory.get(id);
    if (!history) {
      throw new Error("Job history not found");
    }
    const updated = { ...history, ...updates };
    this.jobHistory.set(id, updated);
    return updated;
  }
}

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import ws from "ws";

// Enable WebSocket for Neon
neonConfig.webSocketConstructor = ws;

export class DbStorage implements IStorage {
  private db;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    this.db = drizzle(pool, { schema });
  }

  // Customers
  async getAllCustomers(): Promise<Customer[]> {
    return await this.db.select().from(schema.customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id));
    return result[0];
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await this.db
      .insert(schema.customers)
      .values(insertCustomer)
      .returning();
    return result[0];
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer> {
    const result = await this.db
      .update(schema.customers)
      .set(updates)
      .where(eq(schema.customers.id, id))
      .returning();
    if (!result[0]) throw new Error("Customer not found");
    return result[0];
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.db.delete(schema.customers).where(eq(schema.customers.id, id));
  }

  // Routes
  async getAllRoutes(): Promise<Route[]> {
    return await this.db.select().from(schema.routes);
  }

  async getRoutesByDate(date: string): Promise<Route[]> {
    return await this.db
      .select()
      .from(schema.routes)
      .where(eq(schema.routes.date, date));
  }

  async getRoute(id: string): Promise<Route | undefined> {
    const result = await this.db
      .select()
      .from(schema.routes)
      .where(eq(schema.routes.id, id));
    return result[0];
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const result = await this.db
      .insert(schema.routes)
      .values(insertRoute)
      .returning();
    return result[0];
  }

  async updateRoute(id: string, updates: Partial<InsertRoute>): Promise<Route> {
    const result = await this.db
      .update(schema.routes)
      .set(updates)
      .where(eq(schema.routes.id, id))
      .returning();
    if (!result[0]) throw new Error("Route not found");
    return result[0];
  }

  async updateRouteStatus(id: string, status: string): Promise<Route> {
    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date();
    }
    const result = await this.db
      .update(schema.routes)
      .set(updates)
      .where(eq(schema.routes.id, id))
      .returning();
    if (!result[0]) throw new Error("Route not found");
    return result[0];
  }

  async deleteRoute(id: string): Promise<void> {
    await this.db.delete(schema.routes).where(eq(schema.routes.id, id));
  }

  // Invoices
  async getAllInvoices(): Promise<Invoice[]> {
    return await this.db.select().from(schema.invoices);
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    return await this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.customerId, customerId));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id));
    return result[0];
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const result = await this.db
      .insert(schema.invoices)
      .values(insertInvoice)
      .returning();
    return result[0];
  }

  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const result = await this.db
      .update(schema.invoices)
      .set(updates)
      .where(eq(schema.invoices.id, id))
      .returning();
    if (!result[0]) throw new Error("Invoice not found");
    return result[0];
  }

  async markInvoicePaid(id: string, paymentIntentId: string): Promise<Invoice> {
    const result = await this.db
      .update(schema.invoices)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      })
      .where(eq(schema.invoices.id, id))
      .returning();
    if (!result[0]) throw new Error("Invoice not found");
    return result[0];
  }

  // Job History
  async getAllJobHistory(): Promise<JobHistory[]> {
    return await this.db.select().from(schema.jobHistory);
  }

  async getJobHistoryByCustomer(customerId: string): Promise<JobHistory[]> {
    return await this.db
      .select()
      .from(schema.jobHistory)
      .where(eq(schema.jobHistory.customerId, customerId));
  }

  async createJobHistory(insertHistory: InsertJobHistory): Promise<JobHistory> {
    const result = await this.db
      .insert(schema.jobHistory)
      .values(insertHistory)
      .returning();
    return result[0];
  }

  async updateJobHistory(id: string, updates: Partial<InsertJobHistory>): Promise<JobHistory> {
    const result = await this.db
      .update(schema.jobHistory)
      .set(updates)
      .where(eq(schema.jobHistory.id, id))
      .returning();
    if (!result[0]) throw new Error("Job history not found");
    return result[0];
  }

  // Messages
  async getAllMessages(): Promise<Message[]> {
    return await this.db.select().from(schema.messages).orderBy(schema.messages.sentAt);
  }

  async getMessagesByCustomer(customerId: string): Promise<Message[]> {
    return await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.customerId, customerId))
      .orderBy(schema.messages.sentAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await this.db
      .insert(schema.messages)
      .values(insertMessage)
      .returning();
    return result[0];
  }

  // Schedule Rules
  async getAllScheduleRules(): Promise<ScheduleRule[]> {
    return await this.db.select().from(schema.scheduleRules);
  }

  async getScheduleRulesByCustomer(customerId: string): Promise<ScheduleRule[]> {
    return await this.db
      .select()
      .from(schema.scheduleRules)
      .where(eq(schema.scheduleRules.customerId, customerId));
  }

  async createScheduleRule(insertRule: InsertScheduleRule): Promise<ScheduleRule> {
    const result = await this.db
      .insert(schema.scheduleRules)
      .values(insertRule)
      .returning();
    return result[0];
  }

  async updateScheduleRule(id: string, updates: Partial<InsertScheduleRule>): Promise<ScheduleRule> {
    const result = await this.db
      .update(schema.scheduleRules)
      .set(updates)
      .where(eq(schema.scheduleRules.id, id))
      .returning();
    if (!result[0]) throw new Error("Schedule rule not found");
    return result[0];
  }

  async deleteScheduleRule(id: string): Promise<void> {
    await this.db.delete(schema.scheduleRules).where(eq(schema.scheduleRules.id, id));
  }

  // Reminder Logs
  async createReminderLog(insertLog: InsertReminderLog): Promise<ReminderLog> {
    const result = await this.db
      .insert(schema.reminderLogs)
      .values(insertLog)
      .returning();
    return result[0];
  }

  async getReminderLogsByDate(serviceDate: string): Promise<ReminderLog[]> {
    return await this.db
      .select()
      .from(schema.reminderLogs)
      .where(eq(schema.reminderLogs.serviceDate, serviceDate));
  }
}

export const storage = new DbStorage();
