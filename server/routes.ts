import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import {
  insertCustomerSchema,
  insertRouteSchema,
  insertInvoiceSchema,
  insertJobHistorySchema,
  insertMessageSchema,
  insertScheduleRuleSchema,
} from "@shared/schema";

// Initialize Stripe - from Replit Stripe integration blueprint
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

// Twilio setup
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: any = null;
if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
  // Dynamically import twilio only if credentials are available
  import("twilio").then((twilio) => {
    twilioClient = twilio.default(twilioAccountSid, twilioAuthToken);
  }).catch(() => {
    console.warn("Twilio not available - SMS notifications disabled");
  });
}

// Helper function to send SMS
async function sendSMS(to: string, message: string) {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log(`SMS would be sent to ${to}: ${message}`);
    return;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to,
    });
  } catch (error) {
    console.error("Failed to send SMS:", error);
  }
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
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
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
        // Send SMS based on status
        if (status === "in_route") {
          await sendSMS(
            customer.phone,
            `Hi ${customer.name}! Your SillyDog technician is on the way to ${customer.address}. We'll text you when the service is complete!`
          );
          
          // Create job history entry
          await storage.createJobHistory({
            customerId: customer.id,
            routeId: route.id,
            serviceDate: route.date,
            smsInRouteSent: true,
            smsCompleteSent: false,
          });
        } else if (status === "completed") {
          await sendSMS(
            customer.phone,
            `Service complete at ${customer.address}! Your yard is all cleaned up. Thank you for choosing SillyDog!`
          );
          
          // Update job history
          const jobHistory = await storage.getAllJobHistory();
          const job = jobHistory.find(j => j.routeId === route.id);
          if (job) {
            await storage.updateJobHistory(job.id, {
              smsCompleteSent: true,
            });
          }
        }
      }
      
      res.json(route);
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
      res.status(201).json(rule);
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
        // Check if day of week matches
        if (rule.byDay !== dayOfWeek) {
          continue;
        }
        
        // Calculate if this date matches the schedule
        const startDate = new Date(rule.dtStart);
        const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let shouldGenerate = false;
        if (rule.frequency === "weekly") {
          // Weekly: every 7 days
          shouldGenerate = daysDiff >= 0 && daysDiff % 7 === 0;
        } else if (rule.frequency === "biweekly") {
          // Biweekly: every 14 days
          shouldGenerate = daysDiff >= 0 && daysDiff % 14 === 0;
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
          const existingCustomers = await storage.getCustomers();
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
          const customers = await storage.getCustomers();
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

  const httpServer = createServer(app);
  return httpServer;
}
