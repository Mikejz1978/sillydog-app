import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User accounts with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("customer"), // 'admin', 'staff', 'customer'
  customerId: varchar("customer_id"), // Link to customers table for customer accounts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;

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
  stripePaymentMethodId: text("stripe_payment_method_id"), // Saved payment method for autopay
  autopayEnabled: boolean("autopay_enabled").notNull().default(false), // Auto-charge on 1st of month
  lat: decimal("lat", { precision: 10, scale: 7 }), // Latitude for geocoding
  lng: decimal("lng", { precision: 10, scale: 7 }), // Longitude for geocoding
  smsOptIn: boolean("sms_opt_in").notNull().default(true), // SMS reminder opt-in
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
  serviceType: text("service_type").notNull().default("regular"), // 'regular', 'one-time', 'new-start'
  timerStartedAt: timestamp("timer_started_at"),
  timerStoppedAt: timestamp("timer_stopped_at"),
  calculatedCost: decimal("calculated_cost", { precision: 10, scale: 2 }),
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
  calculatedCost: decimal("calculated_cost", { precision: 10, scale: 2 }), // For timer-based billing
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
  direction: true,
  status: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Schedule Rules (Recurring Scheduling)
export const scheduleRules = pgTable("schedule_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  frequency: text("frequency").notNull(), // 'weekly', 'biweekly', 'one-time', 'new-start'
  byDay: integer("by_day").notNull(), // 0=Sunday ... 6=Saturday
  dtStart: text("dt_start").notNull(), // YYYY-MM-DD format - first service date
  windowStart: text("window_start").notNull(), // HH:MM format
  windowEnd: text("window_end").notNull(), // HH:MM format
  timezone: text("timezone").notNull().default("America/Chicago"),
  notes: text("notes"),
  addons: text("addons").array(), // e.g., ['extra-yard', 'odor-spray']
  paused: boolean("paused").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduleRuleSchema = createInsertSchema(scheduleRules).omit({
  id: true,
  createdAt: true,
});

export type ScheduleRule = typeof scheduleRules.$inferSelect;
export type InsertScheduleRule = z.infer<typeof insertScheduleRuleSchema>;

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

// Reminder Logs
export const reminderLogs = pgTable("reminder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  serviceDate: text("service_date").notNull(), // YYYY-MM-DD format
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  twilioSid: text("twilio_sid"),
  status: text("status").notNull().default("sent"), // 'sent', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReminderLogSchema = createInsertSchema(reminderLogs).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type ReminderLog = typeof reminderLogs.$inferSelect;
export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;

// Helper function to calculate service price
export function calculateServicePrice(servicePlan: string, numberOfDogs: number): number {
  const plan = servicePlan as keyof typeof pricingRates;
  const dogs = Math.min(numberOfDogs, 8) as keyof typeof pricingRates.weekly;
  
  if (pricingRates[plan] && pricingRates[plan][dogs]) {
    return pricingRates[plan][dogs];
  }
  
  return 25.00; // default fallback
}

// Helper function to calculate timer-based billing
// For one-time and new-start services: $100/hour
// 0-15 min: normal schedule price
// 30 min: $50, 45 min: $75, 60 min: $100
export function calculateTimerBasedPrice(durationMinutes: number, servicePlan: string, numberOfDogs: number): number {
  // If under 15 minutes, charge normal schedule price
  if (durationMinutes <= 15) {
    return calculateServicePrice(servicePlan, numberOfDogs);
  }
  
  // Otherwise, charge based on time at $100/hour rate
  const hours = durationMinutes / 60;
  return Math.round(hours * 100 * 100) / 100; // Round to 2 decimal places
}
