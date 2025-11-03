import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customer Management
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  servicePlan: text("service_plan").notNull(), // 'weekly', 'biweekly', 'one-time'
  numberOfDogs: integer("number_of_dogs").notNull().default(1),
  gateCode: text("gate_code"),
  yardNotes: text("yard_notes"),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  billingMethod: text("billing_method").notNull().default("invoice"), // 'card', 'invoice'
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// Routes & Scheduling
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // YYYY-MM-DD format
  customerId: varchar("customer_id").notNull(),
  scheduledTime: text("scheduled_time"), // HH:MM format
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'in_route', 'completed'
  orderIndex: integer("order_index").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("unpaid"), // 'unpaid', 'paid', 'overdue'
  dueDate: text("due_date").notNull(), // YYYY-MM-DD format
  paidAt: timestamp("paid_at"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  paidAt: true,
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Job History
export const jobHistory = pgTable("job_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  routeId: varchar("route_id"),
  serviceDate: text("service_date").notNull(), // YYYY-MM-DD format
  duration: integer("duration"), // in minutes
  notes: text("notes"),
  photoBefore: text("photo_before"), // base64 encoded image
  photoAfter: text("photo_after"), // base64 encoded image
  smsInRouteSent: boolean("sms_in_route_sent").notNull().default(false),
  smsCompleteSent: boolean("sms_complete_sent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobHistorySchema = createInsertSchema(jobHistory).omit({
  id: true,
  createdAt: true,
});

export type JobHistory = typeof jobHistory.$inferSelect;
export type InsertJobHistory = z.infer<typeof insertJobHistorySchema>;

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  messageText: text("message_text").notNull(),
  status: text("status").notNull().default("sent"), // 'sent', 'delivered', 'failed'
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Service Plan Pricing
export const pricingRates = {
  weekly: {
    1: 25.00,
    2: 30.00,
    3: 35.00,
    4: 40.00,
    5: 45.00,
    6: 50.00,
    7: 55.00,
    8: 60.00,
  },
  biweekly: {
    1: 30.00,
    2: 35.00,
    3: 40.00,
    4: 45.00,
    5: 50.00,
    6: 55.00,
    7: 60.00,
    8: 65.00,
  },
  "one-time": {
    1: 50.00,
    2: 60.00,
    3: 70.00,
    4: 80.00,
    5: 90.00,
    6: 100.00,
    7: 110.00,
    8: 120.00,
  },
};

// Helper function to calculate service price
export function calculateServicePrice(servicePlan: string, numberOfDogs: number): number {
  const plan = servicePlan as keyof typeof pricingRates;
  const dogs = Math.min(numberOfDogs, 8) as keyof typeof pricingRates.weekly;
  
  if (pricingRates[plan] && pricingRates[plan][dogs]) {
    return pricingRates[plan][dogs];
  }
  
  return 25.00; // default fallback
}
