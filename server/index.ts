import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startScheduledJobs } from "./jobs";
import { addNewServiceTypes } from "./add-new-service-types";
import passport from "./auth";
import { csrfProtection } from "./middleware/csrf";

const app = express();

// Trust proxy for Replit and Render deployments
app.set('trust proxy', 1);

// Setup PostgreSQL session store
// Use standard pg Pool for Render, Neon serverless Pool for Replit
const PgSession = ConnectPgSimple(session);
const isRender = process.env.RENDER === 'true';
const pgPool = isRender 
  ? new PgPool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new NeonPool({
      connectionString: process.env.DATABASE_URL,
    });

// Session configuration
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax", // Use 'lax' for same-site requests to work properly
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Stripe webhook must be registered BEFORE JSON body parser
// to receive the raw body for signature verification
import Stripe from "stripe";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-10-29.clover",
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  
  if (!stripeWebhookSecret) {
    console.warn("Stripe webhook secret not configured");
    return res.status(400).send("Webhook secret not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📨 Stripe webhook received: ${event.type}`);

  // Import storage dynamically to avoid circular dependencies
  const { storage } = await import("./storage");
  
  // Helper to send SMS (imported dynamically)
  const sendSMS = async (phone: string, message: string) => {
    const telnyxApiKey = process.env.TELNYX_API_KEY;
    const telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER;
    if (!telnyxApiKey || !telnyxPhoneNumber) return;
    
    try {
      await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${telnyxApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: telnyxPhoneNumber, to: phone, text: message })
      });
    } catch (error) {
      console.error("SMS send error:", error);
    }
  };

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoiceId;
        
        if (invoiceId) {
          const invoice = await storage.getInvoice(invoiceId);
          if (invoice && invoice.status !== "paid") {
            await storage.markInvoicePaid(invoiceId, paymentIntent.id);
            console.log(`✅ Invoice ${invoiceId} marked as paid via webhook`);
            
            const customer = await storage.getCustomer(invoice.customerId);
            if (customer?.smsOptIn) {
              await sendSMS(
                customer.phone,
                `Payment received! Invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} has been paid. Thank you!`
              );
            }
          }
        }
        break;
      }
      
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        
        if (invoiceId) {
          const invoice = await storage.getInvoice(invoiceId);
          if (invoice && invoice.status !== "paid") {
            await storage.markInvoicePaid(invoiceId, session.payment_intent as string);
            console.log(`✅ Invoice ${invoiceId} marked as paid via checkout session`);
            
            const customer = await storage.getCustomer(invoice.customerId);
            if (customer?.smsOptIn) {
              await sendSMS(
                customer.phone,
                `Payment received! Invoice #${invoice.invoiceNumber} for $${parseFloat(invoice.amount).toFixed(2)} has been paid. Thank you!`
              );
            }
          }
        }
        break;
      }

      case "setup_intent.succeeded": {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        const customerId = setupIntent.metadata?.customerId;
        const paymentMethodId = setupIntent.payment_method as string;
        
        if (customerId && paymentMethodId) {
          await storage.updateCustomer(customerId, {
            stripePaymentMethodId: paymentMethodId,
            autopayEnabled: true,
            billingMethod: "card",
          });
          console.log(`✅ Customer ${customerId} card saved via webhook`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error(`❌ Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message}`);
        break;
      }
    }
  } catch (error: any) {
    console.error("Webhook processing error:", error);
  }

  res.json({ received: true });
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

// Apply CSRF protection globally to all state-changing API requests
// EXCEPT webhooks which come from external services without CSRF tokens
app.use("/api", (req, res, next) => {
  // Skip CSRF for Telnyx webhook (external service)
  if (req.path === "/webhooks/telnyx") {
    return next();
  }
  // Skip CSRF for Stripe webhook (already handled separately with raw body)
  if (req.path === "/stripe/webhook") {
    return next();
  }
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Safe migration: ADD new service types without deleting old ones
  await addNewServiceTypes();
  
  startScheduledJobs();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
  
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
