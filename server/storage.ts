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
  type ServiceType,
  type InsertServiceType,
  type BookingRequest,
  type InsertBookingRequest,
  type Notification,
  type InsertNotification,
  type User,
  type UpsertUser,
  type Review,
  type InsertReview,
  type InsertUser,
  type Settings,
  type InsertSettings,
  type Announcement,
  type InsertAnnouncement,
  type AnnouncementRecipient,
  type Payment,
  type InsertPayment,
  type PaymentApplication,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;


  // Customers
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Routes
  getAllRoutes(): Promise<Route[]>;
  getRoutesByDate(date: string): Promise<Route[]>;
  getRoutesByCustomerAndDateRange(customerId: string, startDate: string, endDate: string): Promise<Route[]>;
  getRoutesByScheduleRuleId(scheduleRuleId: string): Promise<Route[]>;
  getRoute(id: string): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: string, route: Partial<InsertRoute>): Promise<Route>;
  updateRouteStatus(id: string, status: string): Promise<Route>;
  deleteRoute(id: string): Promise<void>;
  deleteFutureScheduledRoutes(customerId: string, fromDate: string): Promise<number>;
  deleteFutureScheduledRoutesByScheduleRuleId(scheduleRuleId: string): Promise<number>;
  skipRoute(id: string, userId: string, reason: string, notes?: string): Promise<Route>;
  unskipRoute(id: string): Promise<Route>;

  // Invoices
  getAllInvoices(): Promise<Invoice[]>;
  getInvoicesByCustomer(customerId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  markInvoicePaid(id: string, paymentIntentId: string): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;

  // Job History
  getAllJobHistory(): Promise<JobHistory[]>;
  getJobHistoryByCustomer(customerId: string): Promise<JobHistory[]>;
  createJobHistory(history: InsertJobHistory): Promise<JobHistory>;
  updateJobHistory(id: string, history: Partial<InsertJobHistory>): Promise<JobHistory>;

  // Messages
  getAllMessages(): Promise<Message[]>;
  getMessagesByCustomer(customerId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(externalMessageId: string, status: string): Promise<void>;
  findCustomerByPhone(phone: string): Promise<Customer | undefined>;
  getUnreadMessageCount(): Promise<number>;
  markMessagesReadForCustomer(customerId: string): Promise<void>;

  // Schedule Rules
  getAllScheduleRules(): Promise<ScheduleRule[]>;
  getScheduleRulesByCustomer(customerId: string): Promise<ScheduleRule[]>;
  createScheduleRule(rule: InsertScheduleRule): Promise<ScheduleRule>;
  updateScheduleRule(id: string, rule: Partial<InsertScheduleRule>): Promise<ScheduleRule>;
  deleteScheduleRule(id: string): Promise<void>;

  // Reminder Logs
  createReminderLog(log: InsertReminderLog): Promise<ReminderLog>;
  getReminderLogsByDate(serviceDate: string): Promise<ReminderLog[]>;

  // Service Types (Price Book)
  getAllServiceTypes(): Promise<ServiceType[]>;
  getActiveServiceTypes(): Promise<ServiceType[]>;
  getServiceType(id: string): Promise<ServiceType | undefined>;
  createServiceType(serviceType: InsertServiceType): Promise<ServiceType>;
  updateServiceType(id: string, serviceType: Partial<InsertServiceType>): Promise<ServiceType>;
  deleteServiceType(id: string): Promise<void>;

  // Booking Requests
  getAllBookingRequests(): Promise<BookingRequest[]>;
  getPendingBookingRequests(): Promise<BookingRequest[]>;
  getBookingRequest(id: string): Promise<BookingRequest | undefined>;
  createBookingRequest(request: InsertBookingRequest): Promise<BookingRequest>;
  updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest>;
  deleteBookingRequest(id: string): Promise<void>;

  // Notifications
  getAllNotifications(): Promise<Notification[]>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification>;
  updateNotificationSMSStatus(id: string, smsDelivered: boolean): Promise<Notification>;

  // Reviews
  getAllReviews(): Promise<Review[]>;
  getPublicReviews(): Promise<Review[]>;
  getReviewByToken(token: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<InsertReview>): Promise<Review>;
  deleteReview(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>): Promise<Settings>;

  // Announcements
  getAllAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement>;
  createAnnouncementRecipient(recipient: { announcementId: string; customerId: string; customerName: string; customerPhone: string; status?: string; externalMessageId?: string; errorMessage?: string; }): Promise<AnnouncementRecipient>;
  updateAnnouncementRecipient(id: string, updates: Partial<AnnouncementRecipient>): Promise<AnnouncementRecipient>;
  getAnnouncementRecipients(announcementId: string): Promise<AnnouncementRecipient[]>;

  // Field Payments
  getAllPayments(): Promise<Payment[]>;
  getPaymentsByCustomer(customerId: string): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment>;
  createPaymentApplication(paymentId: string, invoiceId: string, amount: string): Promise<PaymentApplication>;
  getPaymentApplicationsByPayment(paymentId: string): Promise<PaymentApplication[]>;
}

export class MemStorage implements IStorage {
  private customers: Map<string, Customer>;
  private routes: Map<string, Route>;
  private invoices: Map<string, Invoice>;
  private jobHistory: Map<string, JobHistory>;
  private bookingRequests: Map<string, BookingRequest>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.customers = new Map();
    this.routes = new Map();
    this.invoices = new Map();
    this.jobHistory = new Map();
    this.bookingRequests = new Map();
    this.notifications = new Map();
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

  async getRoutesByCustomerAndDateRange(customerId: string, startDate: string, endDate: string): Promise<Route[]> {
    return Array.from(this.routes.values()).filter(
      (route) => route.customerId === customerId && route.date >= startDate && route.date <= endDate
    );
  }

  async getRoutesByScheduleRuleId(scheduleRuleId: string): Promise<Route[]> {
    return Array.from(this.routes.values()).filter(
      (route) => route.scheduleRuleId === scheduleRuleId
    );
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

  async skipRoute(id: string, userId: string, reason: string, notes?: string): Promise<Route> {
    const route = this.routes.get(id);
    if (!route) {
      throw new Error("Route not found");
    }
    const updated = {
      ...route,
      status: "skipped",
      billable: true,
      skippedAt: new Date(),
      skippedBy: userId,
      skipReason: reason,
      skipNotes: notes || null,
    };
    this.routes.set(id, updated);
    return updated;
  }

  async unskipRoute(id: string): Promise<Route> {
    const route = this.routes.get(id);
    if (!route) {
      throw new Error("Route not found");
    }
    const updated = {
      ...route,
      status: "scheduled",
      billable: true,
      skippedAt: null,
      skippedBy: null,
      skipReason: null,
      skipNotes: null,
    };
    this.routes.set(id, updated);
    return updated;
  }

  async deleteRoute(id: string): Promise<void> {
    this.routes.delete(id);
  }

  async deleteFutureScheduledRoutes(customerId: string, fromDate: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    // Use the later of fromDate or tomorrow to preserve same-day in-progress stops
    const effectiveFromDate = fromDate > today ? fromDate : new Date(new Date(today).setDate(new Date(today).getDate() + 1)).toISOString().split("T")[0];
    
    const routesToDelete = Array.from(this.routes.values()).filter(
      route => route.customerId === customerId && 
               route.date >= effectiveFromDate && 
               route.status === 'scheduled'
    );
    
    for (const route of routesToDelete) {
      this.routes.delete(route.id);
    }
    
    return routesToDelete.length;
  }

  async deleteFutureScheduledRoutesByScheduleRuleId(scheduleRuleId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    
    const routesToDelete = Array.from(this.routes.values()).filter(
      route => route.scheduleRuleId === scheduleRuleId && 
               route.date > today && 
               route.status === 'scheduled'
    );
    
    for (const route of routesToDelete) {
      this.routes.delete(route.id);
    }
    
    return routesToDelete.length;
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

  async deleteInvoice(id: string): Promise<void> {
    if (!this.invoices.has(id)) {
      throw new Error("Invoice not found");
    }
    this.invoices.delete(id);
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

  // Booking Requests
  async getAllBookingRequests(): Promise<BookingRequest[]> {
    return Array.from(this.bookingRequests.values());
  }

  async getPendingBookingRequests(): Promise<BookingRequest[]> {
    return Array.from(this.bookingRequests.values()).filter(
      (request) => request.status === "pending"
    );
  }

  async getBookingRequest(id: string): Promise<BookingRequest | undefined> {
    return this.bookingRequests.get(id);
  }

  async createBookingRequest(insertRequest: InsertBookingRequest): Promise<BookingRequest> {
    const id = randomUUID();
    const request: BookingRequest = {
      ...insertRequest,
      id,
      status: "pending",
      customerId: null,
      adminNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bookingRequests.set(id, request);
    return request;
  }

  async updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest> {
    const request = this.bookingRequests.get(id);
    if (!request) {
      throw new Error("Booking request not found");
    }
    const updated = { ...request, ...updates, updatedAt: new Date() };
    this.bookingRequests.set(id, updated);
    return updated;
  }

  async deleteBookingRequest(id: string): Promise<void> {
    this.bookingRequests.delete(id);
  }

  // Notifications
  async getAllNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => !n.readAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    const updated = { ...notification, readAt: new Date() };
    this.notifications.set(id, updated);
    return updated;
  }

  async updateNotificationSMSStatus(id: string, smsDelivered: boolean): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error("Notification not found");
    }
    const updated = { ...notification, smsDelivered };
    this.notifications.set(id, updated);
    return updated;
  }

  // Messages, Schedule Rules, Reminder Logs, Users not implemented in MemStorage
  async getAllMessages(): Promise<Message[]> { return []; }
  async getMessagesByCustomer(_customerId: string): Promise<Message[]> { return []; }
  async createMessage(_message: InsertMessage): Promise<Message> { throw new Error("Not implemented"); }
  async updateMessageStatus(_externalMessageId: string, _status: string): Promise<void> { throw new Error("Not implemented"); }
  async findCustomerByPhone(_phone: string): Promise<Customer | undefined> { return undefined; }
  async getUnreadMessageCount(): Promise<number> { return 0; }
  async markMessagesReadForCustomer(_customerId: string): Promise<void> { }
  async getAllScheduleRules(): Promise<ScheduleRule[]> { return []; }
  async getScheduleRulesByCustomer(_customerId: string): Promise<ScheduleRule[]> { return []; }
  async createScheduleRule(_rule: InsertScheduleRule): Promise<ScheduleRule> { throw new Error("Not implemented"); }
  async updateScheduleRule(_id: string, _rule: Partial<InsertScheduleRule>): Promise<ScheduleRule> { throw new Error("Not implemented"); }
  async deleteScheduleRule(_id: string): Promise<void> { throw new Error("Not implemented"); }
  async createReminderLog(_log: InsertReminderLog): Promise<ReminderLog> { throw new Error("Not implemented"); }
  async getReminderLogsByDate(_serviceDate: string): Promise<ReminderLog[]> { return []; }
  async getUser(_id: string): Promise<User | undefined> { return undefined; }
  async getUserByEmail(_email: string): Promise<User | undefined> { return undefined; }
  async createUser(_user: InsertUser): Promise<User> { throw new Error("Not implemented"); }
  async upsertUser(_user: UpsertUser): Promise<User> { throw new Error("Not implemented"); }
  async getAllUsers(): Promise<User[]> { return []; }
  async updateUser(_id: string, _updates: Partial<UpsertUser>): Promise<User> { throw new Error("Not implemented"); }
  async deleteUser(_id: string): Promise<void> { throw new Error("Not implemented"); }
  async getSettings(): Promise<Settings> { throw new Error("Not implemented"); }
  async updateSettings(_updates: Partial<InsertSettings>): Promise<Settings> { throw new Error("Not implemented"); }
  async getAllAnnouncements(): Promise<Announcement[]> { return []; }
  async getAnnouncement(_id: string): Promise<Announcement | undefined> { return undefined; }
  async createAnnouncement(_announcement: InsertAnnouncement): Promise<Announcement> { throw new Error("Not implemented"); }
  async updateAnnouncement(_id: string, _updates: Partial<Announcement>): Promise<Announcement> { throw new Error("Not implemented"); }
  async createAnnouncementRecipient(_recipient: { announcementId: string; customerId: string; customerName: string; customerPhone: string; status?: string; externalMessageId?: string; errorMessage?: string; }): Promise<AnnouncementRecipient> { throw new Error("Not implemented"); }
  async updateAnnouncementRecipient(_id: string, _updates: Partial<AnnouncementRecipient>): Promise<AnnouncementRecipient> { throw new Error("Not implemented"); }
  async getAnnouncementRecipients(_announcementId: string): Promise<AnnouncementRecipient[]> { return []; }
}

import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { eq, and, desc, gte, lte, gt, sql, isNull, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import ws from "ws";

// Enable WebSocket for Neon
neonConfig.webSocketConstructor = ws;

export class DbStorage implements IStorage {
  private db;

  constructor() {
    const isRender = process.env.RENDER === 'true';
    
    if (isRender) {
      // Use standard pg Pool for Render
      const pool = new PgPool({ 
        connectionString: process.env.DATABASE_URL!,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      this.db = drizzlePg(pool, { schema });
    } else {
      // Use Neon serverless Pool for Replit
      const pool = new NeonPool({ connectionString: process.env.DATABASE_URL! });
      this.db = drizzleNeon(pool, { schema });
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db
      .insert(schema.users)
      .values(insertUser)
      .returning();
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const result = await this.db
      .insert(schema.users)
      .values(user)
      .onConflictDoUpdate({
        target: schema.users.email,
        set: user,
      })
      .returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(schema.users);
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const result = await this.db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.delete(schema.users).where(eq(schema.users.id, id));
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

  async getRoutesByCustomerAndDateRange(customerId: string, startDate: string, endDate: string): Promise<Route[]> {
    return await this.db
      .select()
      .from(schema.routes)
      .where(
        and(
          eq(schema.routes.customerId, customerId),
          gte(schema.routes.date, startDate),
          lte(schema.routes.date, endDate)
        )
      );
  }

  async getRoutesByScheduleRuleId(scheduleRuleId: string): Promise<Route[]> {
    return await this.db
      .select()
      .from(schema.routes)
      .where(eq(schema.routes.scheduleRuleId, scheduleRuleId));
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

  async skipRoute(id: string, userId: string, reason: string, notes?: string): Promise<Route> {
    const result = await this.db
      .update(schema.routes)
      .set({
        status: "skipped",
        billable: true,
        skippedAt: new Date(),
        skippedBy: userId,
        skipReason: reason,
        skipNotes: notes || null,
      })
      .where(eq(schema.routes.id, id))
      .returning();
    if (!result[0]) throw new Error("Route not found");
    return result[0];
  }

  async unskipRoute(id: string): Promise<Route> {
    const result = await this.db
      .update(schema.routes)
      .set({
        status: "scheduled",
        billable: true,
        skippedAt: null,
        skippedBy: null,
        skipReason: null,
        skipNotes: null,
      })
      .where(eq(schema.routes.id, id))
      .returning();
    if (!result[0]) throw new Error("Route not found");
    return result[0];
  }

  async deleteRoute(id: string): Promise<void> {
    await this.db.delete(schema.routes).where(eq(schema.routes.id, id));
  }

  async deleteFutureScheduledRoutes(customerId: string, fromDate: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    // Use the later of fromDate or tomorrow to preserve same-day in-progress stops
    const tomorrow = new Date(new Date(today).setDate(new Date(today).getDate() + 1)).toISOString().split("T")[0];
    const effectiveFromDate = fromDate > today ? fromDate : tomorrow;
    
    const result = await this.db
      .delete(schema.routes)
      .where(
        and(
          eq(schema.routes.customerId, customerId),
          gte(schema.routes.date, effectiveFromDate),
          eq(schema.routes.status, 'scheduled')
        )
      )
      .returning();
    
    return result.length;
  }

  async deleteFutureScheduledRoutesByScheduleRuleId(scheduleRuleId: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    
    const result = await this.db
      .delete(schema.routes)
      .where(
        and(
          eq(schema.routes.scheduleRuleId, scheduleRuleId),
          gt(schema.routes.date, today),
          eq(schema.routes.status, 'scheduled')
        )
      )
      .returning();
    
    return result.length;
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

  async deleteInvoice(id: string): Promise<void> {
    const result = await this.db
      .delete(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .returning();
    if (!result[0]) throw new Error("Invoice not found");
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

  async updateMessageStatus(externalMessageId: string, status: string): Promise<void> {
    await this.db
      .update(schema.messages)
      .set({ status })
      .where(eq(schema.messages.externalMessageId, externalMessageId));
  }

  async findCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const cleanDigits = phone.replace(/\D/g, '');
    
    // Try exact match first
    let results = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.phone, cleanDigits))
      .limit(1);
    
    if (results[0]) return results[0];
    
    // If incoming has country code (11 digits starting with 1), try without it
    if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
      const withoutCountryCode = cleanDigits.substring(1);
      results = await this.db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.phone, withoutCountryCode))
        .limit(1);
      if (results[0]) return results[0];
    }
    
    // If incoming is 10 digits, try with country code prefix
    if (cleanDigits.length === 10) {
      const withCountryCode = '1' + cleanDigits;
      results = await this.db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.phone, withCountryCode))
        .limit(1);
      if (results[0]) return results[0];
    }
    
    return undefined;
  }

  async getUnreadMessageCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(and(
        eq(schema.messages.direction, 'inbound'),
        sql`${schema.messages.readAt} IS NULL`
      ));
    return Number(result[0]?.count || 0);
  }

  async markMessagesReadForCustomer(customerId: string): Promise<void> {
    await this.db
      .update(schema.messages)
      .set({ readAt: new Date() })
      .where(and(
        eq(schema.messages.customerId, customerId),
        eq(schema.messages.direction, 'inbound'),
        sql`${schema.messages.readAt} IS NULL`
      ));
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

  // Service Types (Price Book)
  async getAllServiceTypes(): Promise<ServiceType[]> {
    return await this.db.select().from(schema.serviceTypes).orderBy(schema.serviceTypes.name);
  }

  async getActiveServiceTypes(): Promise<ServiceType[]> {
    return await this.db
      .select()
      .from(schema.serviceTypes)
      .where(eq(schema.serviceTypes.active, true))
      .orderBy(schema.serviceTypes.name);
  }

  async getServiceType(id: string): Promise<ServiceType | undefined> {
    const result = await this.db
      .select()
      .from(schema.serviceTypes)
      .where(eq(schema.serviceTypes.id, id));
    return result[0];
  }

  async createServiceType(insertServiceType: InsertServiceType): Promise<ServiceType> {
    const result = await this.db
      .insert(schema.serviceTypes)
      .values(insertServiceType)
      .returning();
    return result[0];
  }

  async updateServiceType(id: string, updates: Partial<InsertServiceType>): Promise<ServiceType> {
    const result = await this.db
      .update(schema.serviceTypes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.serviceTypes.id, id))
      .returning();
    if (!result[0]) throw new Error("Service type not found");
    return result[0];
  }

  async deleteServiceType(id: string): Promise<void> {
    await this.db.delete(schema.serviceTypes).where(eq(schema.serviceTypes.id, id));
  }

  // Booking Requests
  async getAllBookingRequests(): Promise<BookingRequest[]> {
    return await this.db.select().from(schema.bookingRequests).orderBy(schema.bookingRequests.createdAt);
  }

  async getPendingBookingRequests(): Promise<BookingRequest[]> {
    return await this.db
      .select()
      .from(schema.bookingRequests)
      .where(eq(schema.bookingRequests.status, "pending"))
      .orderBy(schema.bookingRequests.createdAt);
  }

  async getBookingRequest(id: string): Promise<BookingRequest | undefined> {
    const result = await this.db
      .select()
      .from(schema.bookingRequests)
      .where(eq(schema.bookingRequests.id, id));
    return result[0];
  }

  async createBookingRequest(insertRequest: InsertBookingRequest): Promise<BookingRequest> {
    const result = await this.db
      .insert(schema.bookingRequests)
      .values(insertRequest)
      .returning();
    return result[0];
  }

  async updateBookingRequest(id: string, updates: Partial<BookingRequest>): Promise<BookingRequest> {
    const result = await this.db
      .update(schema.bookingRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.bookingRequests.id, id))
      .returning();
    if (!result[0]) throw new Error("Booking request not found");
    return result[0];
  }

  async deleteBookingRequest(id: string): Promise<void> {
    await this.db
      .delete(schema.bookingRequests)
      .where(eq(schema.bookingRequests.id, id));
  }

  // Notifications
  async getAllNotifications(): Promise<Notification[]> {
    return await this.db.select().from(schema.notifications).orderBy(schema.notifications.createdAt);
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return await this.db
      .select()
      .from(schema.notifications)
      .where(isNull(schema.notifications.readAt))
      .orderBy(desc(schema.notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await this.db
      .insert(schema.notifications)
      .values(insertNotification)
      .returning();
    return result[0];
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const result = await this.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(eq(schema.notifications.id, id))
      .returning();
    if (!result[0]) throw new Error("Notification not found");
    return result[0];
  }

  async updateNotificationSMSStatus(id: string, smsDelivered: boolean): Promise<Notification> {
    const result = await this.db
      .update(schema.notifications)
      .set({ smsDelivered })
      .where(eq(schema.notifications.id, id))
      .returning();
    if (!result[0]) throw new Error("Notification not found");
    return result[0];
  }

  // Reviews
  async getAllReviews(): Promise<Review[]> {
    return await this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.status, "submitted"))
      .orderBy(desc(schema.reviews.submittedAt));
  }

  async getPublicReviews(): Promise<Review[]> {
    return await this.db
      .select()
      .from(schema.reviews)
      .where(and(
        eq(schema.reviews.isPublic, true),
        inArray(schema.reviews.status, ["submitted", "approved"])
      ))
      .orderBy(desc(schema.reviews.createdAt));
  }

  async getReviewByToken(token: string): Promise<Review | undefined> {
    const result = await this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.reviewToken, token));
    return result[0];
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const result = await this.db
      .insert(schema.reviews)
      .values(insertReview)
      .returning();
    return result[0];
  }

  async updateReview(id: string, updates: Partial<InsertReview>): Promise<Review> {
    const result = await this.db
      .update(schema.reviews)
      .set(updates)
      .where(eq(schema.reviews.id, id))
      .returning();
    if (!result[0]) throw new Error("Review not found");
    return result[0];
  }

  async deleteReview(id: string): Promise<void> {
    await this.db
      .delete(schema.reviews)
      .where(eq(schema.reviews.id, id));
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const result = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.id, "default"));
    
    // If no settings exist, create default
    if (!result[0]) {
      const defaultSettings = await this.db
        .insert(schema.settings)
        .values({
          id: "default",
          businessName: "SillyDog Pooper Scooper Services",
        })
        .returning();
      return defaultSettings[0];
    }
    
    return result[0];
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const result = await this.db
      .update(schema.settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.settings.id, "default"))
      .returning();
    
    if (!result[0]) {
      // If no settings exist, create with updates
      const created = await this.db
        .insert(schema.settings)
        .values({
          id: "default",
          businessName: updates.businessName || "SillyDog Pooper Scooper Services",
          ...updates,
        })
        .returning();
      return created[0];
    }
    
    return result[0];
  }

  // Announcements
  async getAllAnnouncements(): Promise<Announcement[]> {
    return await this.db
      .select()
      .from(schema.announcements)
      .orderBy(desc(schema.announcements.createdAt));
  }

  async getAnnouncement(id: string): Promise<Announcement | undefined> {
    const result = await this.db
      .select()
      .from(schema.announcements)
      .where(eq(schema.announcements.id, id));
    return result[0];
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await this.db
      .insert(schema.announcements)
      .values(announcement)
      .returning();
    return result[0];
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement> {
    const result = await this.db
      .update(schema.announcements)
      .set(updates)
      .where(eq(schema.announcements.id, id))
      .returning();
    if (!result[0]) throw new Error("Announcement not found");
    return result[0];
  }

  async createAnnouncementRecipient(recipient: { announcementId: string; customerId: string; customerName: string; customerPhone: string; status?: string; externalMessageId?: string; errorMessage?: string; }): Promise<AnnouncementRecipient> {
    const result = await this.db
      .insert(schema.announcementRecipients)
      .values({
        announcementId: recipient.announcementId,
        customerId: recipient.customerId,
        customerName: recipient.customerName,
        customerPhone: recipient.customerPhone,
        status: recipient.status || "pending",
        externalMessageId: recipient.externalMessageId,
        errorMessage: recipient.errorMessage,
      })
      .returning();
    return result[0];
  }

  async updateAnnouncementRecipient(id: string, updates: Partial<AnnouncementRecipient>): Promise<AnnouncementRecipient> {
    const result = await this.db
      .update(schema.announcementRecipients)
      .set(updates)
      .where(eq(schema.announcementRecipients.id, id))
      .returning();
    if (!result[0]) throw new Error("Announcement recipient not found");
    return result[0];
  }

  async getAnnouncementRecipients(announcementId: string): Promise<AnnouncementRecipient[]> {
    return await this.db
      .select()
      .from(schema.announcementRecipients)
      .where(eq(schema.announcementRecipients.announcementId, announcementId));
  }

  // Field Payments
  async getAllPayments(): Promise<Payment[]> {
    return await this.db
      .select()
      .from(schema.payments)
      .orderBy(desc(schema.payments.createdAt));
  }

  async getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
    return await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.customerId, customerId))
      .orderBy(desc(schema.payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, id));
    return result[0];
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await this.db
      .insert(schema.payments)
      .values(payment)
      .returning();
    return result[0];
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const result = await this.db
      .update(schema.payments)
      .set(updates)
      .where(eq(schema.payments.id, id))
      .returning();
    if (!result[0]) throw new Error("Payment not found");
    return result[0];
  }

  async createPaymentApplication(paymentId: string, invoiceId: string, amount: string): Promise<PaymentApplication> {
    const result = await this.db
      .insert(schema.paymentApplications)
      .values({
        paymentId,
        invoiceId,
        amount,
      })
      .returning();
    return result[0];
  }

  async getPaymentApplicationsByPayment(paymentId: string): Promise<PaymentApplication[]> {
    return await this.db
      .select()
      .from(schema.paymentApplications)
      .where(eq(schema.paymentApplications.paymentId, paymentId));
  }
}

export const storage = new DbStorage();
