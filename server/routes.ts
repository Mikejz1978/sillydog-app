import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import {
  insertCustomerSchema,
  insertRouteSchema,
  insertInvoiceSchema,
  insertJobHistorySchema,
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
            `Hi ${customer.name}! Your SillyDog technician is on the way to ${customer.address}. We'll text you when the service is complete! 🐾`
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
            `Service complete at ${customer.address}! Your yard is all cleaned up. Thank you for choosing SillyDog! 🐾`
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
          `New invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} is now available. Due date: ${invoice.dueDate}. Thank you! 🐾`
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
          `Payment received! Invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} has been paid. Thank you! 🐾`
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

  const httpServer = createServer(app);
  return httpServer;
}
