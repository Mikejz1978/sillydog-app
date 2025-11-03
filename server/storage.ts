import {
  type Customer,
  type InsertCustomer,
  type Route,
  type InsertRoute,
  type Invoice,
  type InsertInvoice,
  type JobHistory,
  type InsertJobHistory,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
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

export const storage = new MemStorage();
