import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import twilio from "twilio";
import { storage } from "./storage";
import {
  insertCustomerSchema,
  insertRouteSchema,
  insertInvoiceSchema,
  insertJobHistorySchema,
  insertMessageSchema,
  insertScheduleRuleSchema,
  insertServiceTypeSchema,
  insertBookingRequestSchema,
} from "@shared/schema";
import { geocodeAddress, findBestFitDay, type Coordinates } from "./services/geocoding";
import { generateMonthlyInvoices } from "./services/billing";
import { sendNightBeforeReminders } from "./services/reminders";
import { notifyAdminOfNewBooking } from "./services/notifications";
import rateLimit from "express-rate-limit";

// Initialize Stripe - from Replit Stripe integration blueprint
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Twilio setup
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: any = null;
if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
  try {
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    console.log("✅ Twilio client initialized successfully");
    console.log(`📱 Using phone number: ${twilioPhoneNumber}`);
  } catch (error) {
    console.error("❌ Failed to initialize Twilio:", error);
  }
} else {
  console.warn("⚠️ Twilio credentials not found - SMS notifications disabled");
  console.warn(`   TWILIO_ACCOUNT_SID: ${twilioAccountSid ? 'SET' : 'MISSING'}`);
  console.warn(`   TWILIO_AUTH_TOKEN: ${twilioAuthToken ? 'SET' : 'MISSING'}`);
  console.warn(`   TWILIO_PHONE_NUMBER: ${twilioPhoneNumber ? 'SET' : 'MISSING'}`);
}

// Helper function to send SMS
async function sendSMS(to: string, message: string) {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log(`⚠️ SMS NOT SENT - Twilio not configured. Would send to ${to}: ${message}`);
    return;
  }

  // Ensure phone number is in E.164 format (starts with +)
  let formattedPhone = to.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });
    console.log(`✅ SMS sent successfully to ${formattedPhone} - SID: ${result.sid}`);
  } catch (error: any) {
    console.error(`❌ Failed to send SMS to ${formattedPhone}:`, error.message);
    console.error(`   Error code: ${error.code}`);
    console.error(`   More info: ${error.moreInfo}`);
    throw error;
  }
}

// Helper function to generate routes for a schedule rule
async function generateRoutesForSchedule(rule: any, daysAhead: number): Promise<number> {
  const startDate = new Date(rule.dtStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Start generating from today or dtStart, whichever is later
  const generateFrom = startDate > today ? startDate : today;
  
  let routesCreated = 0;
  
  // Generate routes for the next 'daysAhead' days
  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(generateFrom);
    targetDate.setDate(generateFrom.getDate() + i);
    
    const dayOfWeek = targetDate.getDay(); // 0=Sunday ... 6=Saturday
    const targetDateStr = targetDate.toISOString().split("T")[0];
    
    // Check if day of week matches (byDay is an array of days)
    if (!rule.byDay || !rule.byDay.includes(dayOfWeek)) {
      continue;
    }
    
    // Calculate if this date matches the schedule frequency
    const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let shouldGenerate = false;
    if (rule.frequency === "weekly") {
      // For weekly schedules with multiple days, generate on matching days
      shouldGenerate = daysDiff >= 0;
    } else if (rule.frequency === "biweekly") {
      // Biweekly: every 14 days, but only on specified days
      shouldGenerate = daysDiff >= 0 && Math.floor(daysDiff / 7) % 2 === 0;
    } else if (rule.frequency === "one-time" || rule.frequency === "new-start") {
      // Only generate once on the start date
      shouldGenerate = daysDiff === 0;
    }
    
    if (shouldGenerate) {
      // Check if route already exists for this customer and date
      const existingRoutes = await storage.getRoutesByDate(targetDateStr);
      const alreadyExists = existingRoutes.some(r => r.customerId === rule.customerId);
      
      if (!alreadyExists) {
        await storage.createRoute({
          date: targetDateStr,
          customerId: rule.customerId,
          scheduledTime: rule.windowStart,
          status: "scheduled",
          orderIndex: 0,
        });
        routesCreated++;
      }
    }
  }
  
  return routesCreated;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========== ROUTE OPTIMIZATION ==========
  app.post("/api/routes/optimize", async (req, res) => {
    try {
      const { date } = req.body;
      
      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      const routes = await storage.getRoutesByDate(date);
      
      if (routes.length === 0) {
        return res.json({ message: "No routes to optimize" });
      }

      // Get customer details for all routes
      const routesWithCustomers = await Promise.all(
        routes.map(async (route) => {
          const customer = await storage.getCustomer(route.customerId);
          return { route, customer };
        })
      );

      // Simple optimization algorithm: alphabetical by address (proxy for geographic sorting)
      // In a real system, you'd use geocoding + traveling salesman algorithm
      const optimized = routesWithCustomers.sort((a, b) => {
        if (!a.customer || !b.customer) return 0;
        return a.customer.address.localeCompare(b.customer.address);
      });

      // Update order indexes
      await Promise.all(
        optimized.map(({ route }, index) =>
          storage.updateRoute(route.id, { orderIndex: index })
        )
      );

      const updatedRoutes = await storage.getRoutesByDate(date);
      res.json(updatedRoutes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PHOTO UPLOAD ROUTE ==========
  app.post("/api/job-history/:id/photos", async (req, res) => {
    try {
      const { photoBefore, photoAfter } = req.body;
      
      // Validate photo is base64 encoded image
      const isValidImage = (base64: string) => {
        if (!base64 || typeof base64 !== 'string') return false;
        // Check for valid image MIME types in base64 prefix
        const validTypes = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/webp', 'data:image/gif'];
        return validTypes.some(type => base64.startsWith(type));
      };
      
      // Validate photo size (max 5MB each when base64 encoded)
      if (photoBefore) {
        if (!isValidImage(photoBefore)) {
          return res.status(400).json({ message: "Before photo must be a valid image (JPEG, PNG, WebP, or GIF)" });
        }
        if (photoBefore.length > 7000000) {
          return res.status(400).json({ message: "Before photo too large (max 5MB)" });
        }
      }
      
      if (photoAfter) {
        if (!isValidImage(photoAfter)) {
          return res.status(400).json({ message: "After photo must be a valid image (JPEG, PNG, WebP, or GIF)" });
        }
        if (photoAfter.length > 7000000) {
          return res.status(400).json({ message: "After photo too large (max 5MB)" });
        }
      }
      
      const updated = await storage.updateJobHistory(req.params.id, {
        photoBefore,
        photoAfter,
      });
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CUSTOMER ROUTES ==========
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validated = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validated);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      
      // If customer is being archived/inactivated, pause all their schedules
      if (req.body.status === 'inactive') {
        const schedules = await storage.getScheduleRulesByCustomer(req.params.id);
        await Promise.all(
          schedules.map(schedule => 
            storage.updateScheduleRule(schedule.id, { paused: true })
          )
        );
      }
      
      // If customer is being reactivated, unpause all their schedules
      if (req.body.status === 'active') {
        const schedules = await storage.getScheduleRulesByCustomer(req.params.id);
        await Promise.all(
          schedules.map(schedule => 
            storage.updateScheduleRule(schedule.id, { paused: false })
          )
        );
      }
      
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      // Delete all schedule rules for this customer
      const schedules = await storage.getScheduleRulesByCustomer(req.params.id);
      await Promise.all(
        schedules.map(schedule => storage.deleteScheduleRule(schedule.id))
      );
      
      // Delete future routes that haven't been started yet
      const allRoutes = await storage.getAllRoutes();
      const today = new Date().toISOString().split("T")[0];
      const futureRoutes = allRoutes.filter(
        route => route.customerId === req.params.id && 
                 route.date >= today && 
                 route.status === 'scheduled'
      );
      await Promise.all(
        futureRoutes.map(route => storage.deleteRoute(route.id))
      );
      
      // Finally delete the customer
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ROUTE ROUTES ==========
  app.get("/api/routes", async (req, res) => {
    try {
      const { date } = req.query;
      let routes;
      if (date && typeof date === "string") {
        routes = await storage.getRoutesByDate(date);
      } else {
        routes = await storage.getAllRoutes();
      }
      res.json(routes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/routes/today", async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const routes = await storage.getRoutesByDate(today);
      res.json(routes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/routes/:id", async (req, res) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }
      res.json(route);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/routes", async (req, res) => {
    try {
      const validated = insertRouteSchema.parse(req.body);
      const route = await storage.createRoute(validated);
      res.status(201).json(route);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/routes/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const route = await storage.updateRouteStatus(req.params.id, status);
      
      // Get customer info for SMS notifications
      const customer = await storage.getCustomer(route.customerId);
      
      if (customer) {
        // Send SMS based on status (only if customer has opted in)
        if (status === "in_route") {
          if (customer.smsOptIn && customer.phone) {
            await sendSMS(
              customer.phone,
              `Hi ${customer.name}! Your SillyDog technician is on the way to ${customer.address}. We'll text you when the service is complete!`
            );
            console.log(`✅ "In Route" SMS sent to ${customer.name} at ${customer.phone}`);
          } else {
            console.log(`ℹ️ "In Route" SMS NOT sent to ${customer.name} - SMS Opt-In: ${customer.smsOptIn}, Phone: ${customer.phone ? 'Yes' : 'No'}`);
          }
          
          // Create job history entry
          await storage.createJobHistory({
            customerId: customer.id,
            routeId: route.id,
            serviceDate: route.date,
            smsInRouteSent: customer.smsOptIn && !!customer.phone,
            smsCompleteSent: false,
          });
        } else if (status === "completed") {
          if (customer.smsOptIn && customer.phone) {
            await sendSMS(
              customer.phone,
              `Service complete at ${customer.address}! Your yard is all cleaned up. Thank you for choosing SillyDog!`
            );
            console.log(`✅ "Service Complete" SMS sent to ${customer.name} at ${customer.phone}`);
          } else {
            console.log(`ℹ️ "Service Complete" SMS NOT sent to ${customer.name} - SMS Opt-In: ${customer.smsOptIn}, Phone: ${customer.phone ? 'Yes' : 'No'}`);
          }
          
          // Update job history
          const jobHistory = await storage.getAllJobHistory();
          const job = jobHistory.find(j => j.routeId === route.id);
          if (job) {
            await storage.updateJobHistory(job.id, {
              smsCompleteSent: customer.smsOptIn && !!customer.phone,
            });
          }
        }
      }
      
      res.json(route);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== TIMER ROUTES ==========
  app.post("/api/routes/:id/timer/start", async (req, res) => {
    try {
      const route = await storage.updateRoute(req.params.id, {
        timerStartedAt: new Date().toISOString(),
      });
      res.json(route);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/routes/:id/timer/stop", async (req, res) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }

      if (!route.timerStartedAt) {
        return res.status(400).json({ message: "Timer has not been started" });
      }

      const stoppedAt = new Date();
      const startedAt = new Date(route.timerStartedAt);
      const durationMinutes = Math.round((stoppedAt.getTime() - startedAt.getTime()) / 60000);

      // Get customer for pricing calculation
      const customer = await storage.getCustomer(route.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Calculate cost based on service type
      let calculatedCost = 0;
      if (route.serviceType === "one-time" || route.serviceType === "new-start") {
        // Timer-based billing at $100/hour
        if (durationMinutes <= 15) {
          // Use normal schedule price for under 15 minutes
          const { calculateServicePrice } = await import("@shared/schema");
          calculatedCost = calculateServicePrice(customer.servicePlan, customer.numberOfDogs);
        } else {
          // $100/hour rate
          const hours = durationMinutes / 60;
          calculatedCost = Math.round(hours * 100 * 100) / 100; // Round to 2 decimal places
        }
      }

      // Update route with timer stop and calculated cost
      const updatedRoute = await storage.updateRoute(req.params.id, {
        timerStoppedAt: stoppedAt.toISOString(),
        calculatedCost: calculatedCost.toString(),
      });

      // Update job history with duration and cost
      const jobHistory = await storage.getAllJobHistory();
      const job = jobHistory.find(j => j.routeId === route.id);
      if (job) {
        await storage.updateJobHistory(job.id, {
          duration: durationMinutes,
          calculatedCost: calculatedCost.toString(),
        });
      }

      res.json({
        route: updatedRoute,
        durationMinutes,
        calculatedCost,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/routes/:id", async (req, res) => {
    try {
      await storage.deleteRoute(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== INVOICE ROUTES ==========
  app.get("/api/invoices", async (req, res) => {
    try {
      const { customerId } = req.query;
      let invoices;
      if (customerId && typeof customerId === "string") {
        invoices = await storage.getInvoicesByCustomer(customerId);
      } else {
        invoices = await storage.getAllInvoices();
      }
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const validated = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(validated);
      
      // Send SMS notification about new invoice
      const customer = await storage.getCustomer(invoice.customerId);
      if (customer) {
        await sendSMS(
          customer.phone,
          `New invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} is now available. Due date: ${invoice.dueDate}. Thank you!`
        );
      }
      
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== STRIPE PAYMENT ROUTES ==========
  // Stripe payment route for one-time payments (from Stripe integration blueprint)
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, invoiceId } = req.body;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "usd",
        metadata: {
          invoiceId: invoiceId || "",
        },
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Mark invoice as paid after successful payment
  app.post("/api/invoices/:id/pay", async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      const invoice = await storage.markInvoicePaid(req.params.id, paymentIntentId);
      
      // Send payment confirmation SMS
      const customer = await storage.getCustomer(invoice.customerId);
      if (customer) {
        await sendSMS(
          customer.phone,
          `Payment received! Invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} has been paid. Thank you!`
        );
      }
      
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== JOB HISTORY ROUTES ==========
  app.get("/api/job-history", async (req, res) => {
    try {
      const { customerId } = req.query;
      let history;
      if (customerId && typeof customerId === "string") {
        history = await storage.getJobHistoryByCustomer(customerId);
      } else {
        history = await storage.getAllJobHistory();
      }
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/job-history", async (req, res) => {
    try {
      const validated = insertJobHistorySchema.parse(req.body);
      const history = await storage.createJobHistory(validated);
      res.status(201).json(history);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== MESSAGES ROUTES ==========
  app.get("/api/messages", async (req, res) => {
    try {
      const { customerId } = req.query;
      let messages;
      if (customerId && typeof customerId === "string") {
        messages = await storage.getMessagesByCustomer(customerId);
      } else {
        messages = await storage.getAllMessages();
      }
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/messages/send", async (req, res) => {
    try {
      const validated = insertMessageSchema.parse(req.body);
      
      // Get customer details for phone number
      const customer = await storage.getCustomer(validated.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Send SMS via Twilio
      await sendSMS(customer.phone, validated.messageText);
      
      // Save message to database
      const message = await storage.createMessage({
        ...validated,
        direction: "outbound",
        status: "sent",
      });
      
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== SCHEDULE RULES ROUTES ==========
  app.get("/api/schedule-rules", async (req, res) => {
    try {
      const { customerId } = req.query;
      let rules;
      if (customerId && typeof customerId === "string") {
        rules = await storage.getScheduleRulesByCustomer(customerId);
      } else {
        rules = await storage.getAllScheduleRules();
      }
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/schedule-rules", async (req, res) => {
    try {
      const validated = insertScheduleRuleSchema.parse(req.body);
      const rule = await storage.createScheduleRule(validated);
      
      // Auto-generate routes for the next 60 days
      const routesGenerated = await generateRoutesForSchedule(rule, 60);
      
      res.status(201).json({
        ...rule,
        routesGenerated,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/schedule-rules/:id", async (req, res) => {
    try {
      const rule = await storage.updateScheduleRule(req.params.id, req.body);
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/schedule-rules/:id", async (req, res) => {
    try {
      await storage.deleteScheduleRule(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== SERVICE TYPES (PRICE BOOK) ROUTES ==========
  app.get("/api/service-types", async (req, res) => {
    try {
      const { active } = req.query;
      let serviceTypes;
      if (active === "true") {
        serviceTypes = await storage.getActiveServiceTypes();
      } else {
        serviceTypes = await storage.getAllServiceTypes();
      }
      res.json(serviceTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/service-types/:id", async (req, res) => {
    try {
      const serviceType = await storage.getServiceType(req.params.id);
      if (!serviceType) {
        return res.status(404).json({ message: "Service type not found" });
      }
      res.json(serviceType);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/service-types", async (req, res) => {
    try {
      const validated = insertServiceTypeSchema.parse(req.body);
      const serviceType = await storage.createServiceType(validated);
      res.status(201).json(serviceType);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/service-types/:id", async (req, res) => {
    try {
      const serviceType = await storage.updateServiceType(req.params.id, req.body);
      res.json(serviceType);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/service-types/:id", async (req, res) => {
    try {
      await storage.deleteServiceType(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== AUTO-GENERATE ROUTES FROM SCHEDULES ==========
  app.post("/api/routes/generate", async (req, res) => {
    try {
      const { date } = req.body; // YYYY-MM-DD format
      const targetDate = date || new Date().toISOString().split("T")[0];
      
      // Get all active (non-paused) schedule rules
      const allRules = await storage.getAllScheduleRules();
      const activeRules = allRules.filter(rule => !rule.paused);
      
      const generatedRoutes = [];
      const today = new Date(targetDate);
      const dayOfWeek = today.getDay(); // 0=Sunday ... 6=Saturday
      
      for (const rule of activeRules) {
        // Check if day of week matches (byDay is an array of days)
        if (!rule.byDay || !rule.byDay.includes(dayOfWeek)) {
          continue;
        }
        
        // Calculate if this date matches the schedule
        const startDate = new Date(rule.dtStart);
        const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let shouldGenerate = false;
        if (rule.frequency === "weekly") {
          // For weekly schedules with multiple days, generate on matching days
          shouldGenerate = daysDiff >= 0;
        } else if (rule.frequency === "biweekly") {
          // Biweekly: every 14 days, but only on specified days
          shouldGenerate = daysDiff >= 0 && Math.floor(daysDiff / 7) % 2 === 0;
        }
        
        if (shouldGenerate) {
          // Check if route already exists for this customer and date
          const existingRoutes = await storage.getRoutesByDate(targetDate);
          const alreadyExists = existingRoutes.some(r => r.customerId === rule.customerId);
          
          if (!alreadyExists) {
            const route = await storage.createRoute({
              date: targetDate,
              customerId: rule.customerId,
              scheduledTime: rule.windowStart,
              status: "scheduled",
              orderIndex: 0,
            });
            generatedRoutes.push(route);
          }
        }
      }
      
      res.json({
        message: `Generated ${generatedRoutes.length} routes for ${targetDate}`,
        routes: generatedRoutes,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CSV IMPORT ==========
  app.post("/api/import/customers", async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ 
          success: false, 
          imported: 0, 
          skipped: 0, 
          errors: ["No CSV data provided"] 
        });
      }

      const lines = csvData.trim().split("\n");
      if (lines.length < 2) {
        return res.status(400).json({ 
          success: false, 
          imported: 0, 
          skipped: 0, 
          errors: ["CSV file is empty or has no data rows"] 
        });
      }

      // Parse CSV headers
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"(.*)"$/, '$1'));
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"(.*)"$/, '$1'));
          const row: Record<string, string> = {};
          
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          // Map HouseCall Pro fields to our schema
          const name = row["Customer Name"] || row["Name"] || row["name"] || "";
          const phone = row["Phone"] || row["phone"] || row["Mobile"] || "";
          const email = row["Email"] || row["email"] || "";
          const address = row["Address"] || row["address"] || row["Street Address"] || "";
          
          if (!name || !phone) {
            skipped++;
            continue;
          }

          // Check for duplicates
          const existingCustomers = await storage.getAllCustomers();
          const isDuplicate = existingCustomers.some(c => 
            c.phone === phone || (email && c.email === email)
          );

          if (isDuplicate) {
            skipped++;
            continue;
          }

          // Create customer
          await storage.createCustomer({
            name,
            address,
            phone,
            email: email || "",
            servicePlan: "weekly",
            numberOfDogs: 1,
            gateCode: "",
            yardNotes: "",
            billingMethod: "invoice",
            status: "active",
          });

          imported++;
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ 
        success: false, 
        imported: 0, 
        skipped: 0, 
        errors: [error instanceof Error ? error.message : "Server error"] 
      });
    }
  });

  app.post("/api/import/schedules", async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData) {
        return res.status(400).json({ 
          success: false, 
          imported: 0, 
          skipped: 0, 
          errors: ["No CSV data provided"] 
        });
      }

      const lines = csvData.trim().split("\n");
      if (lines.length < 2) {
        return res.status(400).json({ 
          success: false, 
          imported: 0, 
          skipped: 0, 
          errors: ["CSV file is empty or has no data rows"] 
        });
      }

      // Parse CSV headers
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"(.*)"$/, '$1'));
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"(.*)"$/, '$1'));
          const row: Record<string, string> = {};
          
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          // Map HouseCall Pro job fields
          const customerName = row["Customer Name"] || row["Name"] || "";
          const scheduledDate = row["Scheduled Date"] || row["Start Date"] || "";
          const scheduledTime = row["Scheduled Time"] || row["Start Time"] || "09:00";
          const jobType = row["Job Type"] || row["Service Type"] || "";
          
          if (!customerName || !scheduledDate) {
            skipped++;
            continue;
          }

          // Find customer by name
          const customers = await storage.getAllCustomers();
          const customer = customers.find(c => 
            c.name.toLowerCase() === customerName.toLowerCase()
          );

          if (!customer) {
            errors.push(`Row ${i + 1}: Customer "${customerName}" not found`);
            skipped++;
            continue;
          }

          // Parse date
          const date = new Date(scheduledDate);
          if (isNaN(date.getTime())) {
            errors.push(`Row ${i + 1}: Invalid date "${scheduledDate}"`);
            skipped++;
            continue;
          }

          const dayOfWeek = date.getDay();
          const dtStart = date.toISOString().split("T")[0];

          // Determine frequency from job type or default to weekly
          let frequency: "weekly" | "biweekly" = "weekly";
          if (jobType.toLowerCase().includes("bi-week") || jobType.toLowerCase().includes("biweek")) {
            frequency = "biweekly";
          }

          // Create schedule rule
          await storage.createScheduleRule({
            customerId: customer.id,
            frequency,
            byDay: dayOfWeek,
            dtStart,
            windowStart: scheduledTime,
            windowEnd: "17:00",
            timezone: "America/Chicago",
            notes: "",
            addons: [],
            paused: false,
          });

          imported++;
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ 
        success: false, 
        imported: 0, 
        skipped: 0, 
        errors: [error instanceof Error ? error.message : "Server error"] 
      });
    }
  });

  // ========== GEOCODING ==========
  app.post("/api/geocode", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }

      const coords = await geocodeAddress(address);
      
      if (!coords) {
        return res.status(404).json({ message: "Could not geocode address" });
      }

      res.json(coords);
    } catch (error) {
      console.error("Geocode error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== FIND BEST FIT DAY ==========
  app.post("/api/find-best-fit", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }

      const coords = await geocodeAddress(address);
      if (!coords) {
        return res.status(404).json({ message: "Could not geocode address" });
      }

      const allSchedules = await storage.getAllScheduleRules();
      const allCustomers = await storage.getAllCustomers();

      // Flatten schedules - a customer with multiple days gets multiple entries
      const customersWithSchedules: Array<{
        lat: string | null;
        lng: string | null;
        dayOfWeek: number;
      }> = [];
      
      for (const schedule of allSchedules.filter(s => !s.paused)) {
        const customer = allCustomers.find(c => c.id === schedule.customerId);
        // byDay is an array, so we need to create an entry for each day
        for (const day of schedule.byDay || []) {
          customersWithSchedules.push({
            lat: customer?.lat ?? null,
            lng: customer?.lng ?? null,
            dayOfWeek: day,
          });
        }
      }

      const bestFitDays = await findBestFitDay(coords, customersWithSchedules);

      res.json({
        coordinates: coords,
        suggestions: bestFitDays,
      });
    } catch (error) {
      console.error("Best fit error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== MONTHLY BILLING JOB ==========
  app.post("/api/billing/generate-monthly", async (req, res) => {
    try {
      const { month, year } = req.body;
      
      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }

      const results = await generateMonthlyInvoices(month, year);
      
      res.json({
        message: "Monthly billing completed",
        results,
      });
    } catch (error) {
      console.error("Monthly billing error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== REMINDER SMS JOB ==========
  app.post("/api/reminders/send-night-before", async (req, res) => {
    try {
      const { serviceDate } = req.body;
      
      if (!serviceDate) {
        return res.status(400).json({ message: "Service date is required" });
      }

      const results = await sendNightBeforeReminders(serviceDate);
      
      res.json({
        message: "Reminders sent",
        results,
      });
    } catch (error) {
      console.error("Reminder error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== PUBLIC BOOKING REQUEST ENDPOINT ==========
  // Rate limiter: 5 requests per 15 minutes per IP
  const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: "Too many booking requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/public/booking", bookingLimiter, async (req, res) => {
    try {
      // Validate request body
      const validation = insertBookingRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid booking data",
          errors: validation.error.errors 
        });
      }

      // Get client IP for spam prevention
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      // Create booking request with IP tracking
      const bookingData = {
        ...validation.data,
        ipAddress,
      };

      const booking = await storage.createBookingRequest(bookingData);

      // Send notifications (SMS + in-app)
      const notificationResult = await notifyAdminOfNewBooking(booking);

      res.status(201).json({
        message: "Booking request received! We'll contact you soon to schedule your service.",
        bookingId: booking.id,
        notifications: {
          smsDelivered: notificationResult.smsDelivered,
          inAppCreated: notificationResult.notificationCreated,
        },
      });
    } catch (error) {
      console.error("Public booking error:", error);
      res.status(500).json({ message: "Unable to process booking request. Please try again later." });
    }
  });

  // ========== BOOKING REQUEST MANAGEMENT ==========
  app.get("/api/booking-requests", async (_req, res) => {
    try {
      const requests = await storage.getAllBookingRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get booking requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/booking-requests/pending", async (_req, res) => {
    try {
      const requests = await storage.getPendingBookingRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get pending requests error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/booking-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // If accepting a booking, automatically create a customer and delete the booking
      if (updates.status === "accepted") {
        const booking = await storage.getBookingRequest(id);
        if (!booking) {
          return res.status(404).json({ message: "Booking request not found" });
        }
        
        let customerId = booking.customerId;
        
        // Only create customer if not already created
        if (!customerId) {
          // Create customer from booking data
          const newCustomer = await storage.createCustomer({
            name: booking.name,
            address: booking.address,
            phone: booking.phone,
            email: booking.email || "",
            servicePlan: booking.preferredServicePlan || "one-time",
            numberOfDogs: booking.numberOfDogs,
            gateCode: "",
            yardNotes: booking.yardNotes || "",
            status: "active",
            billingMethod: "invoice",
            autopayEnabled: false,
            smsOptIn: true,
          });
          
          customerId = newCustomer.id;
          console.log(`✅ Customer created from booking: ${newCustomer.name} (${customerId})`);
        }
        
        // Delete the booking request since it's been converted to a customer
        await storage.deleteBookingRequest(id);
        console.log(`🗑️ Booking request deleted after acceptance: ${booking.name}`);
        
        // Return the customer ID so the frontend knows it was successful
        return res.json({ 
          message: "Booking accepted and customer created",
          customerId,
          deleted: true
        });
      }
      
      const updated = await storage.updateBookingRequest(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Update booking request error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== NOTIFICATIONS MANAGEMENT ==========
  app.get("/api/notifications", async (_req, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/notifications/unread", async (_req, res) => {
    try {
      const notifications = await storage.getUnreadNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Get unread notifications error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== SAVE PAYMENT METHOD FOR AUTOPAY ==========
  app.post("/api/customers/:id/payment-method", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ message: "Payment method ID is required" });
      }

      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let stripeCustomerId = customer.stripeCustomerId;

      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          name: customer.name,
          email: customer.email || undefined,
          phone: customer.phone,
          address: {
            line1: customer.address,
          },
        });
        stripeCustomerId = stripeCustomer.id;
      }

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      const updated = await storage.updateCustomer(id, {
        stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        autopayEnabled: true,
        billingMethod: "card",
      });

      res.json(updated);
    } catch (error) {
      console.error("Payment method setup error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
