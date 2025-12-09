import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import Telnyx from "telnyx";
import { storage } from "./storage";
import passport from "./auth";
import { requireAuth, requireAdmin, requireStaff } from "./middleware/auth";
import { csrfProtection, getCsrfToken } from "./middleware/csrf";
import {
  insertCustomerSchema,
  insertRouteSchema,
  insertInvoiceSchema,
  insertJobHistorySchema,
  insertMessageSchema,
  insertScheduleRuleSchema,
  insertServiceTypeSchema,
  insertBookingRequestSchema,
  insertReviewSchema,
  insertUserSchema,
  insertAnnouncementSchema,
} from "@shared/schema";
import { geocodeAddress, findBestFitDay, type Coordinates } from "./services/geocoding";
import { generateMonthlyInvoices } from "./services/billing";
import { sendNightBeforeReminders } from "./services/reminders";
import { notifyAdminOfNewBooking } from "./services/notifications";
import rateLimit from "express-rate-limit";

// Helper to generate cryptographically secure review token
function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// Initialize Stripe - from Replit Stripe integration blueprint
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Telnyx setup - Using REST API (SDK v4.5.1 has issues)
const telnyxApiKey = process.env.TELNYX_API_KEY;
const telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER;

// Helper function to send SMS via Telnyx REST API
async function sendTelnyxSMS(from: string, to: string, text: string): Promise<{ id: string }> {
  if (!telnyxApiKey) {
    throw new Error("Telnyx API key not configured");
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, text })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telnyx API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  return { id: result.data.id };
}

if (telnyxApiKey && telnyxPhoneNumber) {
  console.log("✅ Telnyx configured (using REST API)");
  console.log(`📱 Phone: ${telnyxPhoneNumber}`);
} else {
  console.warn("⚠️  Telnyx not configured - SMS disabled");
}

// Helper function to send SMS via Telnyx
async function sendSMS(to: string, message: string) {
  if (!telnyxApiKey || !telnyxPhoneNumber) {
    console.log(`⚠️ SMS NOT SENT - Telnyx not configured. Would send to ${to}: ${message}`);
    return;
  }

  // Format phone number to E.164 format for US numbers (+1XXXXXXXXXX)
  let cleanDigits = to.trim().replace(/\D/g, ''); // Remove all non-digits
  
  // Strict validation: ONLY accept 10 digits OR 11 digits starting with 1
  let formattedPhone: string;
  if (cleanDigits.length === 10) {
    // Valid 10-digit US number → add +1 country code
    formattedPhone = '+1' + cleanDigits;
  } else if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
    // Valid 11-digit number with country code → add +
    formattedPhone = '+' + cleanDigits;
  } else {
    // Invalid format - log error and return early (don't break workflows)
    console.error(`❌ Invalid phone number format: "${to}" (${cleanDigits.length} digits after sanitization)`);
    console.error(`   Expected: 10 digits (e.g., 7027877722) or 11 digits starting with 1 (e.g., 17027877722)`);
    console.error(`   SMS NOT SENT. Please update customer record with valid US phone number.`);
    return; // Return early - don't throw error to avoid breaking invoices/routes
  }

  try {
    const result = await sendTelnyxSMS(telnyxPhoneNumber, formattedPhone, message);
    console.log(`✅ SMS sent successfully to ${formattedPhone} via Telnyx - ID: ${result.id}`);
  } catch (error: any) {
    console.error(`❌ Failed to send SMS to ${formattedPhone}:`, error.message);
    // Don't rethrow - log error but allow workflow to continue
    console.error(`   SMS delivery failed but workflow will continue`);
  }
}

// Helper function to generate routes for a schedule rule
async function generateRoutesForSchedule(rule: any, daysAhead: number): Promise<number> {
  console.log(`🔄 Generating routes for schedule ${rule.id} - Days: ${JSON.stringify(rule.byDay)}, Frequency: ${rule.frequency}`);
  
  // Parse dtStart as local date (handles both "YYYY-MM-DD" and ISO timestamp formats)
  // Use UTC accessors to preserve the calendar date, then convert to local midnight
  const parsedDate = new Date(rule.dtStart);
  const startDate = new Date(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate());
  startDate.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Start generating from today or dtStart, whichever is later
  const generateFrom = startDate > today ? startDate : today;
  
  let routesCreated = 0;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
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
    
    console.log(`   ✓ ${targetDateStr} (${dayNames[dayOfWeek]}) matches schedule days`);
    
    // Calculate if this date matches the schedule frequency
    const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let shouldGenerate = false;
    if (rule.frequency === "weekly") {
      // For weekly schedules with multiple days, generate on matching days
      shouldGenerate = daysDiff >= 0;
    } else if (rule.frequency === "biweekly") {
      // Biweekly: Generate routes every other week starting from the FIRST matching day
      // Strategy: Find the first occurrence of the selected day on or after dtStart,
      // then generate routes every 14 days (2 weeks) from that first occurrence
      
      // Find the first occurrence of this day of week on or after dtStart
      const startDayOfWeek = startDate.getDay();
      let daysUntilFirstOccurrence = dayOfWeek - startDayOfWeek;
      if (daysUntilFirstOccurrence < 0) {
        daysUntilFirstOccurrence += 7; // If the day already passed this week, go to next week
      }
      
      // Calculate the first occurrence date
      const firstOccurrence = new Date(startDate);
      firstOccurrence.setDate(startDate.getDate() + daysUntilFirstOccurrence);
      
      // Calculate days from the first occurrence to the target date
      const daysFromFirstOccurrence = Math.floor((targetDate.getTime() - firstOccurrence.getTime()) / (1000 * 60 * 60 * 24));
      
      // Generate if this is the first occurrence or exactly 14, 28, 42... days after (every 2 weeks)
      shouldGenerate = daysFromFirstOccurrence >= 0 && daysFromFirstOccurrence % 14 === 0;
      
      if (shouldGenerate) {
        console.log(`   📅 Biweekly: First occurrence ${firstOccurrence.toISOString().split('T')[0]}, target ${targetDateStr}, daysFromFirst=${daysFromFirstOccurrence}`);
      }
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
          scheduleRuleId: rule.id, // Link route to the schedule that created it
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
  // ========== CSRF TOKEN ENDPOINT ==========
  app.get("/api/csrf-token", getCsrfToken);

  // ========== AUTHENTICATION ROUTES ==========
  // Login (CSRF protection applied globally)
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ message: "Login successful", user });
      });
    })(req, res, next);
  });

  // Logout (CSRF protection applied globally)
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // ========== CUSTOMER PORTAL AUTHENTICATION ==========
  // Customer portal login with email and password
  app.post("/api/portal/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find customer by email
      const customers = await storage.getAllCustomers();
      const customer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase());

      if (!customer) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if customer has a portal password set
      if (!customer.portalPassword) {
        return res.status(401).json({ message: "Portal access not set up. Please contact us to set up your account." });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, customer.portalPassword);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Store customer ID in session
      (req.session as any).portalCustomerId = customer.id;

      // Return customer info (without password)
      const { portalPassword, ...customerWithoutPassword } = customer;
      res.json({ message: "Login successful", customer: customerWithoutPassword });
    } catch (error: any) {
      console.error("Portal login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Customer portal logout
  app.post("/api/portal/logout", (req, res) => {
    (req.session as any).portalCustomerId = null;
    res.json({ message: "Logout successful" });
  });

  // Get current portal customer
  app.get("/api/portal/me", async (req, res) => {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        (req.session as any).portalCustomerId = null;
        return res.status(401).json({ message: "Customer not found" });
      }

      // Return customer info (without password)
      const { portalPassword, ...customerWithoutPassword } = customer;
      res.json({ customer: customerWithoutPassword });
    } catch (error: any) {
      console.error("Portal me error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Set up portal password (for new customers or password reset)
  app.post("/api/portal/setup-password", async (req, res) => {
    try {
      const { email, phone, password } = req.body;

      if (!email || !phone || !password) {
        return res.status(400).json({ message: "Email, phone, and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Find customer by email AND phone (for verification)
      const customers = await storage.getAllCustomers();
      const customer = customers.find(
        c => c.email?.toLowerCase() === email.toLowerCase() && 
             c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
      );

      if (!customer) {
        return res.status(404).json({ message: "No customer found with this email and phone combination" });
      }

      // Hash and save password
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateCustomer(customer.id, { portalPassword: hashedPassword });

      res.json({ message: "Portal password set successfully. You can now log in." });
    } catch (error: any) {
      console.error("Portal setup error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get portal customer data (requires authentication)
  app.get("/api/portal/data", async (req, res) => {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get customer's data
      const invoices = (await storage.getAllInvoices()).filter(i => i.customerId === customerId);
      const routes = (await storage.getAllRoutes()).filter(r => r.customerId === customerId);
      const jobHistory = (await storage.getAllJobHistory()).filter(j => j.customerId === customerId);
      const serviceType = customer.serviceTypeId ? await storage.getServiceType(customer.serviceTypeId) : null;

      // Return customer info (without password)
      const { portalPassword, ...customerWithoutPassword } = customer;

      res.json({
        customer: customerWithoutPassword,
        invoices,
        routes,
        jobHistory,
        serviceType,
      });
    } catch (error: any) {
      console.error("Portal data error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update customer profile from portal
  app.patch("/api/portal/profile", async (req, res) => {
    try {
      const customerId = (req.session as any).portalCustomerId;
      
      if (!customerId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Only allow updating specific fields from portal
      const { phone, email, gateCode, yardNotes, smsOptIn, autopayEnabled } = req.body;
      const updates: any = {};

      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (gateCode !== undefined) updates.gateCode = gateCode;
      if (yardNotes !== undefined) updates.yardNotes = yardNotes;
      if (smsOptIn !== undefined) updates.smsOptIn = smsOptIn;
      if (autopayEnabled !== undefined) updates.autopayEnabled = autopayEnabled;

      const customer = await storage.updateCustomer(customerId, updates);
      const { portalPassword, ...customerWithoutPassword } = customer;

      res.json({ customer: customerWithoutPassword });
    } catch (error: any) {
      console.error("Portal profile update error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== USER MANAGEMENT ROUTES (Admin only) ==========
  // Get all users
  app.get("/api/users", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Exclude passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new user (Admin only)
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validated = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validated.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validated.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...validated,
        password: hashedPassword,
      });

      // Exclude password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update user (Admin only)
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const updates: any = { ...req.body };
      
      // Hash password if it's being updated
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const user = await storage.updateUser(req.params.id, updates);
      
      // Exclude password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

      // Get settings for start/end locations
      const settings = await storage.getSettings();
      const hasStartLocation = settings?.routeStartLat && settings?.routeStartLng;

      // Get customer details for all routes
      const routesWithCustomers = await Promise.all(
        routes.map(async (route) => {
          const customer = await storage.getCustomer(route.customerId);
          return { route, customer };
        })
      );

      // Calculate distance between two coordinates (Haversine formula)
      const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      let optimized;

      if (hasStartLocation) {
        // Use nearest neighbor algorithm starting from the configured start location
        const startLat = parseFloat(settings.routeStartLat as string);
        const startLng = parseFloat(settings.routeStartLng as string);
        
        // Filter to customers with valid coordinates
        const withCoords = routesWithCustomers.filter(rc => 
          rc.customer?.lat && rc.customer?.lng
        );
        const withoutCoords = routesWithCustomers.filter(rc => 
          !rc.customer?.lat || !rc.customer?.lng
        );

        // Nearest neighbor algorithm
        const ordered: typeof withCoords = [];
        let remaining = [...withCoords];
        let currentLat = startLat;
        let currentLng = startLng;

        while (remaining.length > 0) {
          // Find the nearest customer to the current position
          let nearestIdx = 0;
          let nearestDist = Infinity;

          for (let i = 0; i < remaining.length; i++) {
            const customer = remaining[i].customer!;
            const dist = calculateDistance(
              currentLat, currentLng,
              parseFloat(customer.lat as string),
              parseFloat(customer.lng as string)
            );
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = i;
            }
          }

          // Add the nearest customer to the ordered list
          const nearest = remaining[nearestIdx];
          ordered.push(nearest);
          currentLat = parseFloat(nearest.customer!.lat as string);
          currentLng = parseFloat(nearest.customer!.lng as string);
          remaining.splice(nearestIdx, 1);
        }

        // Combine optimized routes with those that couldn't be geocoded
        optimized = [...ordered, ...withoutCoords];
        
        console.log(`🗺️ Optimized ${ordered.length} routes using start location, ${withoutCoords.length} without coordinates`);
      } else {
        // Fallback: alphabetical by address
        optimized = routesWithCustomers.sort((a, b) => {
          if (!a.customer || !b.customer) return 0;
          return a.customer.address.localeCompare(b.customer.address);
        });
        console.log("🗺️ Optimized routes alphabetically (no start location configured)");
      }

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

  // ========== ROUTE REORDER ==========
  app.post("/api/routes/reorder", async (req, res) => {
    try {
      const { routeIds } = req.body;
      
      if (!routeIds || !Array.isArray(routeIds) || routeIds.length === 0) {
        return res.status(400).json({ message: "routeIds array is required" });
      }

      // Validate all route IDs are strings and unique
      const uniqueIds = new Set(routeIds);
      if (uniqueIds.size !== routeIds.length) {
        return res.status(400).json({ message: "Duplicate route IDs are not allowed" });
      }

      // Fetch all routes to validate they exist and belong to the same date
      const fetchedRoutes = await Promise.all(
        routeIds.map((routeId: string) => storage.getRoute(routeId))
      );

      // Check all routes exist
      const missingRoutes = fetchedRoutes.filter(r => !r);
      if (missingRoutes.length > 0) {
        return res.status(400).json({ message: "One or more route IDs not found" });
      }

      // Validate all routes are for the same date
      const dates = new Set(fetchedRoutes.map(r => r!.date));
      if (dates.size > 1) {
        return res.status(400).json({ message: "All routes must be for the same date" });
      }

      // Update each route's orderIndex based on its position in the array
      await Promise.all(
        routeIds.map((routeId: string, index: number) =>
          storage.updateRoute(routeId, { orderIndex: index })
        )
      );

      // Return updated routes for this date
      const date = fetchedRoutes[0]!.date;
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
      const { schedule, ...customerData } = req.body;
      console.log(`📝 Creating customer: ${customerData.name}`);
      console.log(`📅 Schedule data received:`, JSON.stringify(schedule));
      
      const validated = insertCustomerSchema.parse(customerData);
      const customer = await storage.createCustomer(validated);
      
      // If schedule data is provided, create schedule rule and generate initial routes
      if (schedule && schedule.byDay && schedule.byDay.length > 0) {
        console.log(`📅 Creating schedule with frequency: "${schedule.frequency}", days: ${JSON.stringify(schedule.byDay)}`);
        
        const scheduleRule = await storage.createScheduleRule({
          customerId: customer.id,
          frequency: schedule.frequency || "weekly",
          byDay: schedule.byDay,
          windowStart: schedule.windowStart || "08:00",
          windowEnd: schedule.windowEnd || "12:00",
          dtStart: new Date().toISOString().split('T')[0],
          paused: false,
        });
        
        console.log(`✅ Schedule rule created: ${scheduleRule.id}, frequency: ${scheduleRule.frequency}`);
        
        // Generate routes for the next 60 days
        const routeCount = await generateRoutesForSchedule(scheduleRule, 60);
        console.log(`🛣️ Generated ${routeCount} routes for schedule ${scheduleRule.id}`);
      }
      
      res.status(201).json(customer);
    } catch (error: any) {
      console.error(`❌ Error creating customer:`, error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      // Validate input data (allow partial updates)
      const validated = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, validated);
      
      // If customer is being archived/inactivated, pause all their schedules AND remove future routes
      if (req.body.status === 'inactive') {
        const schedules = await storage.getScheduleRulesByCustomer(req.params.id);
        await Promise.all(
          schedules.map(schedule => 
            storage.updateScheduleRule(schedule.id, { paused: true })
          )
        );
        
        // Delete all future scheduled routes for this customer (efficient query, not full table scan)
        const today = new Date().toISOString().split("T")[0];
        const deletedCount = await storage.deleteFutureScheduledRoutes(req.params.id, today);
        
        console.log(`🗑️ Archived customer ${customer.name}: Paused ${schedules.length} schedules and removed ${deletedCount} future routes`);
      }
      
      // If customer is being reactivated, unpause all their schedules AND regenerate routes
      if (req.body.status === 'active') {
        const schedules = await storage.getScheduleRulesByCustomer(req.params.id);
        await Promise.all(
          schedules.map(schedule => 
            storage.updateScheduleRule(schedule.id, { paused: false })
          )
        );
        
        // Regenerate routes for the next 60 days for all unpaused schedules
        let totalRoutes = 0;
        for (const schedule of schedules) {
          if (!schedule.paused) {
            const routesGenerated = await generateRoutesForSchedule(schedule, 60);
            totalRoutes += routesGenerated;
          }
        }
        
        console.log(`✅ Reactivated customer ${customer.name}: Unpaused ${schedules.length} schedules and generated ${totalRoutes} new routes`);
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
      
      // Delete future scheduled routes (efficient query)
      const today = new Date().toISOString().split("T")[0];
      await storage.deleteFutureScheduledRoutes(req.params.id, today);
      
      // Finally delete the customer
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Reset customer portal password
  app.post("/api/customers/:id/reset-portal-password", requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateCustomer(req.params.id, { portalPassword: hashedPassword });

      console.log(`✅ Admin reset portal password for customer: ${customer.name}`);
      res.json({ success: true, message: `Portal password reset for ${customer.name}` });
    } catch (error: any) {
      console.error("Failed to reset portal password:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Send portal invite SMS to customer
  app.post("/api/customers/:id/send-portal-invite", requireAdmin, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (!customer.phone) {
        return res.status(400).json({ message: "Customer has no phone number on file" });
      }

      if (!customer.smsOptIn) {
        return res.status(400).json({ message: "Customer has not opted in for SMS notifications" });
      }

      // Generate the portal URL from environment or settings
      // Priority: APP_BASE_URL env var > REPLIT_DEV_DOMAIN > deployed Render URL
      let baseUrl = process.env.APP_BASE_URL;
      if (!baseUrl && process.env.REPLIT_DEV_DOMAIN) {
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      }
      if (!baseUrl) {
        baseUrl = 'https://sillydog-app.onrender.com';
      }
      const portalUrl = `${baseUrl}/portal/login`;

      // Create message based on whether they already have portal access
      let message: string;
      if (customer.portalPassword) {
        message = `Hi ${customer.name}! Access your SillyDog customer portal anytime at ${portalUrl}. Log in with your email address to view services, invoices, and manage your account.`;
      } else {
        message = `Hi ${customer.name}! You're invited to the SillyDog customer portal! Visit ${portalUrl} to sign up. You'll be able to view your service schedule, pay invoices, and manage your account.`;
      }

      await sendSMS(customer.phone, message);

      console.log(`✅ Portal invite SMS sent to ${customer.name} at ${customer.phone}`);
      res.json({ success: true, message: `Portal invite sent to ${customer.name}` });
    } catch (error: any) {
      console.error("Failed to send portal invite:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Clear customer's saved payment method
  app.delete("/api/customers/:id/payment-method", requireAdmin, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Clear Stripe payment method from Stripe if exists
      if (customer.stripeCustomerId && customer.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(customer.stripePaymentMethodId);
        } catch (stripeError) {
          console.warn("Could not detach payment method from Stripe:", stripeError);
        }
      }

      // Clear payment method info from customer record
      await storage.updateCustomer(req.params.id, { 
        stripePaymentMethodId: null,
        autopayEnabled: false,
      });

      console.log(`✅ Admin cleared payment method for customer: ${customer.name}`);
      res.json({ success: true, message: `Payment method cleared for ${customer.name}` });
    } catch (error: any) {
      console.error("Failed to clear payment method:", error);
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
        // Handle status changes
        if (status === "in_route") {
          // Create job history entry (SMS is sent via the "On My Way" button separately)
          await storage.createJobHistory({
            customerId: customer.id,
            routeId: route.id,
            serviceDate: route.date,
            smsInRouteSent: false, // Will be updated when "On My Way" SMS is sent
            smsCompleteSent: false,
          });
        } else if (status === "completed") {
          // Create pending review record with secure token
          const reviewToken = generateSecureToken();
          const pendingReview = await storage.createReview({
            customerId: customer.id,
            routeId: route.id,
            customerName: customer.name,
            rating: null,
            comment: null,
            reviewToken,
            isPublic: true,
            status: "pending",
          });
          
          if (customer.smsOptIn && customer.phone) {
            const reviewUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'your-app.replit.app'}/review/${reviewToken}`;
            
            // Get customizable message template from settings
            const settings = await storage.getSettings();
            const messageTemplate = settings?.smsServiceCompleteMessage || "Service complete at {address}! Your yard is all cleaned up. How did we do? Leave us a review: {reviewUrl}";
            
            // Replace placeholders with actual values
            const message = messageTemplate
              .replace(/\{name\}/g, customer.name)
              .replace(/\{address\}/g, customer.address || "your location")
              .replace(/\{reviewUrl\}/g, reviewUrl);
            
            await sendSMS(customer.phone, message);
            console.log(`✅ "Service Complete" SMS sent to ${customer.name} with review link`);
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

  // Send "On My Way" notification to customer
  app.post("/api/routes/:id/notify-on-way", async (req, res) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }

      const customer = await storage.getCustomer(route.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (!customer.smsOptIn) {
        return res.status(400).json({ message: "Customer has not opted in for SMS notifications" });
      }

      if (!customer.phone) {
        return res.status(400).json({ message: "Customer has no phone number on file" });
      }

      // Get customizable message template from settings
      const settings = await storage.getSettings();
      const messageTemplate = settings?.smsOnMyWayMessage || "Hi {name}! Your SillyDog technician is on the way to {address}. We'll be there shortly! 🐕";
      
      // Replace placeholders with actual values
      const message = messageTemplate
        .replace(/\{name\}/g, customer.name)
        .replace(/\{address\}/g, customer.address || "your location");

      await sendSMS(customer.phone, message);

      console.log(`✅ "On My Way" SMS sent to ${customer.name} at ${customer.phone}`);
      res.json({ success: true, message: `"On My Way" notification sent to ${customer.name}` });
    } catch (error: any) {
      console.error("Failed to send On My Way notification:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Skip route (customer still gets charged)
  app.post("/api/routes/:id/skip", async (req, res) => {
    try {
      const { reason, notes } = req.body;
      const userId = req.user?.id || "system";
      
      if (!reason) {
        return res.status(400).json({ message: "Skip reason is required" });
      }
      
      const route = await storage.skipRoute(req.params.id, userId, reason, notes);
      res.json(route);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Unskip route (restore to scheduled)
  app.post("/api/routes/:id/unskip", async (req, res) => {
    try {
      const route = await storage.unskipRoute(req.params.id);
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

      // Get customer's service type to check if hourly pricing applies
      let calculatedCost = 0;
      const serviceType = await storage.getServiceType(customer.serviceTypeId);
      
      if (serviceType && serviceType.isHourly) {
        // Hourly pricing calculation based on timed duration
        // 15 minutes = regular service price (basePrice)
        // 30 minutes = $50
        // 45 minutes = $75
        // 1 hour = $100
        // >1 hour = $100/hour prorated
        if (durationMinutes <= 15) {
          calculatedCost = parseFloat(serviceType.basePrice);
        } else if (durationMinutes <= 30) {
          calculatedCost = 50.00;
        } else if (durationMinutes <= 45) {
          calculatedCost = 75.00;
        } else if (durationMinutes <= 60) {
          calculatedCost = 100.00;
        } else {
          // For jobs longer than 60 minutes, bill in hourly increments
          // 61-119 min = $200, 120-179 min = $300, etc.
          const hours = Math.ceil(durationMinutes / 60);
          calculatedCost = hours * 100;
        }
      } else if (route.serviceType === "one-time" || route.serviceType === "new-start") {
        // Legacy timer-based billing for backward compatibility
        if (durationMinutes <= 15) {
          calculatedCost = 50.00;
        } else {
          const hours = durationMinutes / 60;
          calculatedCost = Math.round(hours * 100 * 100) / 100;
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

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      await storage.deleteInvoice(req.params.id);
      res.json({ message: "Invoice deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Quick charge customer - creates invoice and charges if autopay enabled
  app.post("/api/customers/:customerId/charge", async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const customer = await storage.getCustomer(customerId);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Get service type for pricing
      const serviceTypes = await storage.getAllServiceTypes();
      let amount = 0;
      let serviceTypeName = "Service";
      let timesPerWeek = 1;
      
      if (customer.serviceTypeId) {
        const serviceType = serviceTypes.find(st => st.id === customer.serviceTypeId);
        if (serviceType) {
          const basePrice = typeof serviceType.basePrice === 'string' 
            ? parseFloat(serviceType.basePrice) 
            : serviceType.basePrice;
          const pricePerExtraDog = typeof serviceType.pricePerExtraDog === 'string'
            ? parseFloat(serviceType.pricePerExtraDog)
            : serviceType.pricePerExtraDog;
          timesPerWeek = serviceType.timesPerWeek || 1;
          
          // Calculate per-visit cost: basePrice covers first dog, pricePerExtraDog for additional dogs
          const extraDogs = Math.max(customer.numberOfDogs - 1, 0);
          const perVisitCost = basePrice + (pricePerExtraDog * extraDogs);
          
          // Calculate monthly amount: perVisitCost * timesPerWeek * 4 weeks
          amount = perVisitCost * timesPerWeek * 4;
          serviceTypeName = serviceType.name;
          
          console.log('Pricing calculation:', {
            serviceTypeName: serviceType.name,
            basePrice,
            pricePerExtraDog,
            numberOfDogs: customer.numberOfDogs,
            timesPerWeek,
            perVisitCost,
            monthlyAmount: amount,
          });
        }
      }
      
      if (amount === 0 || isNaN(amount)) {
        return res.status(400).json({ 
          message: "Customer does not have a service type configured or pricing is invalid. Please set a service type first." 
        });
      }

      // Create invoice
      const invoiceNumber = `INV-${Date.now()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days
      
      const invoice = await storage.createInvoice({
        customerId: customer.id,
        invoiceNumber,
        amount: amount.toFixed(2), // Ensure proper decimal string format
        status: "unpaid",
        dueDate: dueDate.toISOString().split('T')[0],
        description: `${serviceTypeName} (${timesPerWeek}x/week × 4 weeks) - ${customer.numberOfDogs} dog${customer.numberOfDogs > 1 ? 's' : ''}`,
      });

      // If customer has autopay, charge them immediately
      let charged = false;
      if (customer.autopayEnabled && customer.stripeCustomerId && customer.stripePaymentMethodId) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: "usd",
            customer: customer.stripeCustomerId,
            payment_method: customer.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            description: `Charge for ${invoice.invoiceNumber}`,
          });

          if (paymentIntent.status === "succeeded") {
            await storage.markInvoicePaid(invoice.id, paymentIntent.id);
            charged = true;
            
            // Send payment confirmation SMS (non-blocking)
            try {
              await sendSMS(
                customer.phone,
                `Payment received! Invoice #${invoice.invoiceNumber} for $${amount.toFixed(2)} has been paid. Thank you!`
              );
            } catch (smsError: any) {
              console.error(`SMS confirmation failed for ${customer.name}:`, smsError.message);
            }
          }
        } catch (chargeError: any) {
          // If autopay fails, invoice remains unpaid
          console.error(`Autopay failed for ${customer.name}:`, chargeError.message);
        }
      }

      // If not charged, send invoice notification SMS (non-blocking)
      if (!charged) {
        try {
          await sendSMS(
            customer.phone,
            `New invoice #${invoice.invoiceNumber} for $${amount.toFixed(2)} is now available. Due date: ${invoice.dueDate}. Thank you!`
          );
        } catch (smsError: any) {
          console.error(`SMS notification failed for ${customer.name}:`, smsError.message);
        }
      }

      console.log('Charge endpoint response:', {
        invoiceId: invoice.id,
        invoiceAmount: invoice.amount,
        invoiceAmountType: typeof invoice.amount,
        charged,
      });

      res.json({ 
        invoice, 
        charged,
        message: charged 
          ? `Invoice created and customer charged $${amount.toFixed(2)}` 
          : `Invoice created for $${amount.toFixed(2)}. Customer will need to pay manually.`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

      // Send SMS via Telnyx REST API and get message ID
      let externalMessageId: string | undefined;
      if (telnyxApiKey && telnyxPhoneNumber) {
        try {
          let cleanDigits = customer.phone.trim().replace(/\D/g, '');
          let formattedPhone: string;
          if (cleanDigits.length === 10) {
            formattedPhone = '+1' + cleanDigits;
          } else if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
            formattedPhone = '+' + cleanDigits;
          } else {
            throw new Error('Invalid phone number format');
          }

          const result = await sendTelnyxSMS(telnyxPhoneNumber, formattedPhone, validated.messageText);
          externalMessageId = result.id;
          console.log(`✅ SMS sent successfully to ${formattedPhone} - Telnyx ID: ${externalMessageId}`);
        } catch (error: any) {
          console.error(`❌ Failed to send SMS:`, error.message);
          throw new Error(`Failed to send SMS: ${error.message}`);
        }
      }
      
      // Save message to database
      const message = await storage.createMessage({
        ...validated,
        direction: "outbound",
        status: "sent",
        externalMessageId,
      });
      
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== TELNYX WEBHOOK ==========
  // Webhook endpoint for receiving Telnyx events (incoming messages & delivery status)
  app.post("/api/webhooks/telnyx", async (req, res) => {
    try {
      const event = req.body;
      console.log("📨 Telnyx webhook received:", JSON.stringify(event, null, 2));

      // Return 200 immediately to acknowledge receipt
      res.status(200).send('OK');

      // Process webhook asynchronously
      if (!event.data || !event.data.event_type) {
        console.warn("⚠️ Unknown webhook format:", event);
        return;
      }

      const eventType = event.data.event_type;
      const payload = event.data.payload;

      // Handle incoming message
      if (eventType === "message.received") {
        console.log("📥 Incoming message from:", payload.from.phone_number);
        
        // Find customer by phone number
        const customer = await storage.findCustomerByPhone(payload.from.phone_number);
        
        if (!customer) {
          console.warn(`⚠️ No customer found for phone: ${payload.from.phone_number}`);
          return;
        }

        // Store incoming message
        await storage.createMessage({
          customerId: customer.id,
          messageText: payload.text || '',
          direction: "inbound",
          status: "delivered",
          externalMessageId: payload.id,
        });
        
        console.log(`✅ Stored incoming message from customer: ${customer.name}`);
      }
      
      // Handle delivery status update
      else if (eventType === "message.finalized") {
        console.log("📬 Message status update:", payload.to[0].status);
        
        if (payload.id) {
          const status = payload.to[0].status === "delivered" ? "delivered" : "failed";
          await storage.updateMessageStatus(payload.id, status);
          console.log(`✅ Updated message ${payload.id} status to: ${status}`);
        }
      }
      
      else {
        console.log(`ℹ️ Unhandled webhook event type: ${eventType}`);
      }
      
    } catch (error: any) {
      console.error("❌ Webhook processing error:", error);
      // Don't rethrow - webhook already acknowledged with 200
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
      console.log("📅 Creating schedule rule with data:", req.body);
      console.log("📅 Days selected (byDay):", req.body.byDay);
      
      const validated = insertScheduleRuleSchema.parse(req.body);
      const rule = await storage.createScheduleRule(validated);
      
      console.log("✅ Schedule rule created:", rule.id);
      console.log("📅 Schedule rule byDay saved as:", rule.byDay);
      
      // Auto-generate routes for the next 60 days
      const routesGenerated = await generateRoutesForSchedule(rule, 60);
      
      console.log(`✅ Generated ${routesGenerated} routes for schedule ${rule.id}`);
      
      res.status(201).json({
        ...rule,
        routesGenerated,
      });
    } catch (error: any) {
      console.error("❌ Error creating schedule rule:", error);
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
      const scheduleRuleId = req.params.id;
      
      // Delete future scheduled routes that were created by this schedule
      // Uses indexed query with proper date comparison via storage layer
      await storage.deleteFutureScheduledRoutesByScheduleRuleId(scheduleRuleId);
      
      // Delete the schedule rule
      await storage.deleteScheduleRule(scheduleRuleId);
      
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
              scheduleRuleId: rule.id, // Link route to the schedule that created it
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

      // Parse CSV headers with flexible matching
      const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"(.*)"$/, '$1'));
      console.log("CSV Headers found:", rawHeaders);
      
      // Helper function for case-insensitive header matching
      const findColumn = (row: Record<string, string>, possibleNames: string[]): string => {
        for (const name of possibleNames) {
          // Try exact match first
          if (row[name]) return row[name];
          
          // Try case-insensitive match
          const lowerName = name.toLowerCase();
          for (const key of Object.keys(row)) {
            if (key.toLowerCase() === lowerName) {
              return row[key];
            }
          }
        }
        return "";
      };
      
      let imported = 0;
      let skipped = 0;
      let skippedMissingData = 0;
      let skippedDuplicates = 0;
      const errors: string[] = [];

      // Get all existing customers once (optimization)
      const existingCustomers = await storage.getAllCustomers();
      console.log(`Found ${existingCustomers.length} existing customers in database`);

      // Get a default service type for imports (use "1 Dog 1x Week" as default)
      const allServiceTypes = await storage.getAllServiceTypes();
      const defaultServiceType = allServiceTypes.find(st => st.name === "1 Dog 1x Week") || allServiceTypes[0];
      
      if (!defaultServiceType) {
        return res.status(500).json({
          success: false,
          imported: 0,
          skipped: 0,
          errors: ["No service types found in database. Please create service types first."]
        });
      }
      
      console.log(`Using default service type: ${defaultServiceType.name} (ID: ${defaultServiceType.id})`);

      // Track imported identifiers in this batch to prevent duplicates within the CSV
      const importedPhones = new Set<string>();
      const importedEmails = new Set<string>();

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"(.*)"$/, '$1'));
          const row: Record<string, string> = {};
          
          rawHeaders.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });

          // Log first row for debugging
          if (i === 1) {
            console.log("First row data:", row);
          }

          // Flexible column mapping with case-insensitive matching (HouseCall Pro format)
          const name = findColumn(row, ["Display Name", "Customer Name", "Name", "name", "customer_name", "CUSTOMER NAME"]);
          const phone = findColumn(row, ["Mobile Number", "Phone", "phone", "Mobile", "mobile", "PHONE", "Phone Number", "phone_number", "Home Number"]);
          const email = findColumn(row, ["Email", "email", "EMAIL", "E-mail", "e-mail"]);
          const address = findColumn(row, ["Address_1 Street Line 1", "Address", "address", "ADDRESS", "Street Address", "street_address", "STREET ADDRESS"]);
          
          if (!name || !phone) {
            skipped++;
            skippedMissingData++;
            if (i <= 3) {
              console.log(`Row ${i + 1}: Skipped - Missing name (${name}) or phone (${phone})`);
            }
            continue;
          }

          // Check for duplicates in existing database
          const existsInDatabase = existingCustomers.some(c => 
            c.phone === phone || (email && c.email === email)
          );

          // Check for duplicates within this import batch
          const existsInBatch = importedPhones.has(phone) || (email && importedEmails.has(email));

          if (existsInDatabase || existsInBatch) {
            skipped++;
            skippedDuplicates++;
            if (i <= 3) {
              console.log(`Row ${i + 1}: Skipped - Duplicate (phone: ${phone}, email: ${email})`);
            }
            continue;
          }

          // Create customer
          await storage.createCustomer({
            name,
            address,
            phone,
            email: email || "",
            serviceTypeId: defaultServiceType.id,
            numberOfDogs: 1,
            gateCode: "",
            yardNotes: "",
            billingMethod: "invoice",
            status: "active",
          });

          // Track this customer to prevent duplicates later in the same batch
          importedPhones.add(phone);
          if (email) {
            importedEmails.add(email);
          }

          imported++;
          if (imported <= 3) {
            console.log(`Row ${i + 1}: Imported - ${name} (${phone})`);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
          console.error(`Row ${i + 1} error:`, error);
        }
      }

      console.log(`Import complete: ${imported} imported, ${skipped} skipped (${skippedDuplicates} duplicates, ${skippedMissingData} missing data)`);

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        skippedDuplicates,
        skippedMissingData,
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

  // JSON Import for customers
  app.post("/api/import/customers-json", async (req, res) => {
    try {
      const { customers } = req.body;
      
      if (!customers || !Array.isArray(customers)) {
        return res.status(400).json({ 
          success: false, 
          imported: 0, 
          skipped: 0, 
          errors: ["No customer data provided or invalid format. Expected an array of customers."] 
        });
      }

      console.log(`Starting JSON import of ${customers.length} customers`);

      // Get all existing customers for duplicate checking
      const existingCustomers = await storage.getAllCustomers();
      const existingPhones = new Set(existingCustomers.map(c => c.phone?.replace(/\D/g, '')));
      const existingEmails = new Set(existingCustomers.filter(c => c.email).map(c => c.email?.toLowerCase()));

      // Get default service type
      const serviceTypes = await storage.getAllServiceTypes();
      const defaultServiceType = serviceTypes.find(st => st.name === "1 Dog 1x Week") || serviceTypes[0];
      
      if (!defaultServiceType) {
        return res.status(500).json({
          success: false,
          imported: 0,
          skipped: 0,
          errors: ["No service types found. Please set up service types first."]
        });
      }

      let imported = 0;
      let skipped = 0;
      let skippedDuplicates = 0;
      const errors: string[] = [];
      const importedPhones = new Set<string>();
      const importedEmails = new Set<string>();

      for (let i = 0; i < customers.length; i++) {
        try {
          const customer = customers[i];
          
          // Handle different JSON structures - be flexible with field names
          const name = customer.name || customer.Name || customer.customerName || "";
          const address = customer.address || customer.Address || customer.street || "";
          const phone = (customer.phone || customer.Phone || customer.phoneNumber || "").toString().replace(/\D/g, '');
          const email = (customer.email || customer.Email || "").toLowerCase().trim();
          const numberOfDogs = parseInt(customer.numberOfDogs || customer.number_of_dogs || customer.dogs || "1") || 1;
          const gateCode = customer.gateCode || customer.gate_code || customer.gateCode || "";
          const yardNotes = customer.yardNotes || customer.yard_notes || customer.notes || "";
          const smsOptIn = customer.smsOptIn !== false && customer.sms_opt_in !== false;
          const autopayEnabled = customer.autopayEnabled === true || customer.autopay_enabled === true;
          const status = customer.status || "active";

          // Skip if missing required fields
          if (!name || !address || !phone) {
            skipped++;
            if (!name) errors.push(`Row ${i + 1}: Missing name`);
            else if (!address) errors.push(`Row ${i + 1}: Missing address for ${name}`);
            else if (!phone) errors.push(`Row ${i + 1}: Missing phone for ${name}`);
            continue;
          }

          // Check for duplicates
          if (existingPhones.has(phone) || importedPhones.has(phone)) {
            skipped++;
            skippedDuplicates++;
            continue;
          }

          if (email && (existingEmails.has(email) || importedEmails.has(email))) {
            skipped++;
            skippedDuplicates++;
            continue;
          }

          // Find matching service type or use default
          let serviceTypeId = defaultServiceType.id;
          if (customer.serviceTypeId || customer.service_type_id) {
            const requestedId = customer.serviceTypeId || customer.service_type_id;
            const matchingType = serviceTypes.find(st => st.id === requestedId);
            if (matchingType) {
              serviceTypeId = matchingType.id;
            }
          }

          // Create the customer
          await storage.createCustomer({
            name,
            address,
            phone: phone.startsWith('+') ? phone : `+1${phone}`,
            email: email || null,
            serviceTypeId,
            numberOfDogs,
            gateCode: gateCode || null,
            yardNotes: yardNotes || null,
            billingMethod: "invoice",
            status: status === "archived" ? "archived" : "active",
            smsOptIn,
            autopayEnabled,
          });

          importedPhones.add(phone);
          if (email) importedEmails.add(email);
          imported++;

          if (imported <= 3) {
            console.log(`Imported: ${name} (${phone})`);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
          console.error(`Row ${i + 1} error:`, error);
        }
      }

      console.log(`JSON Import complete: ${imported} imported, ${skipped} skipped (${skippedDuplicates} duplicates)`);

      res.json({
        success: errors.length === 0 || imported > 0,
        imported,
        skipped,
        skippedDuplicates,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error("JSON Import error:", error);
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
            byDay: [dayOfWeek],
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
      
      // If accepting a booking, automatically create a customer and mark as completed
      if (updates.status === "accepted") {
        const booking = await storage.getBookingRequest(id);
        if (!booking) {
          return res.status(404).json({ message: "Booking request not found" });
        }
        
        let customerId = booking.customerId;
        
        // Only create customer if not already created
        if (!customerId) {
          // Get default service type (1 Dog 1x Week)
          const serviceTypes = await storage.getAllServiceTypes();
          const defaultServiceType = serviceTypes.find(st => st.name === "1 Dog 1x Week");
          
          if (!defaultServiceType) {
            return res.status(500).json({ message: "Default service type not found" });
          }
          
          // Create customer from booking data
          const newCustomer = await storage.createCustomer({
            name: booking.name,
            address: booking.address,
            phone: booking.phone,
            email: booking.email || "",
            numberOfDogs: booking.numberOfDogs,
            serviceTypeId: defaultServiceType.id,
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
        
        // Mark the booking as completed (instead of deleting) and store the customer ID
        const completed = await storage.updateBookingRequest(id, {
          status: "completed",
          customerId: customerId,
        });
        console.log(`✅ Booking request marked as completed: ${booking.name}`);
        
        // Return the completed booking
        return res.json({ 
          message: "Booking accepted and customer created",
          customerId,
          booking: completed
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

  // ========== REVIEWS MANAGEMENT ==========
  // Public endpoint to submit a review (rate-limited)
  app.post("/api/reviews/submit", async (req, res) => {
    try {
      const { reviewToken, rating, comment } = req.body;

      if (!reviewToken || !rating) {
        return res.status(400).json({ message: "Review token and rating are required" });
      }

      // Validate rating is between 1-5
      const parsedRating = parseInt(rating);
      if (parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5 stars" });
      }

      // Check if review token exists
      const pendingReview = await storage.getReviewByToken(reviewToken);
      if (!pendingReview) {
        return res.status(404).json({ message: "Invalid or expired review link" });
      }

      // Check if review has already been submitted
      if (pendingReview.status === "submitted") {
        return res.status(400).json({ message: "Review already submitted for this service" });
      }

      // Update the review with rating and comment
      const submittedReview = await storage.updateReview(pendingReview.id, {
        rating: parsedRating,
        comment: comment || null,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });

      res.status(201).json({ 
        message: "Thank you for your review!", 
        review: submittedReview 
      });
    } catch (error) {
      console.error("Submit review error:", error);
      res.status(500).json({ message: "Unable to submit review. Please try again." });
    }
  });

  // Admin: Get all reviews
  app.get("/api/reviews", async (_req, res) => {
    try {
      const reviews = await storage.getAllReviews();
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Public: Get public reviews (for display on website)
  app.get("/api/reviews/public", async (_req, res) => {
    try {
      const reviews = await storage.getPublicReviews();
      res.json(reviews);
    } catch (error) {
      console.error("Get public reviews error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Update review visibility
  app.patch("/api/reviews/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const review = await storage.updateReview(id, updates);
      res.json(review);
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin: Delete review
  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReview(id);
      res.json({ message: "Review deleted successfully" });
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== SETTINGS ==========
  // Get current settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update settings
  app.patch("/api/settings", async (req, res) => {
    try {
      const updates = req.body;
      const settings = await storage.updateSettings(updates);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ========== ANNOUNCEMENTS (Bulk SMS Broadcasts) ==========
  // Get all announcements (admin only)
  app.get("/api/announcements", requireAdmin, async (_req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Get announcements error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get count of customers who would receive announcement (admin only)
  // NOTE: This must be registered BEFORE /api/announcements/:id to avoid matching "preview" as an ID
  app.get("/api/announcements/preview/count", requireAdmin, async (_req, res) => {
    try {
      const allCustomers = await storage.getAllCustomers();
      const smsCustomers = allCustomers.filter(
        (c) => c.status === "active" && c.smsOptIn && c.phone
      );
      res.json({ count: smsCustomers.length });
    } catch (error) {
      console.error("Get SMS customer count error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get single announcement with recipients (admin only)
  app.get("/api/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const announcement = await storage.getAnnouncement(id);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      const recipients = await storage.getAnnouncementRecipients(id);
      res.json({ ...announcement, recipients });
    } catch (error) {
      console.error("Get announcement error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Send announcement to all SMS-opted-in customers (admin only)
  app.post("/api/announcements", csrfProtection, requireAdmin, async (req, res) => {
    try {
      // Check if Telnyx is configured - if not, we'll log instead of sending
      const telnyxConfigured = !!(telnyxApiKey && telnyxPhoneNumber);
      if (!telnyxConfigured) {
        console.log("⚠️ Telnyx not configured - announcement will be logged but not sent via SMS");
      }

      // Validate request body using schema
      const parseResult = insertAnnouncementSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { title, messageText, sentBy } = parseResult.data;
      const userId = sentBy || (req as any).user?.id || "system";

      // Get all active customers with SMS opt-in
      const allCustomers = await storage.getAllCustomers();
      const smsCustomers = allCustomers.filter(
        (c) => c.status === "active" && c.smsOptIn && c.phone
      );

      if (smsCustomers.length === 0) {
        return res.status(400).json({ message: "No customers with SMS opt-in found" });
      }

      // Create the announcement record
      const announcement = await storage.createAnnouncement({
        title,
        messageText,
        sentBy: userId,
      });

      // Update with total recipients
      await storage.updateAnnouncement(announcement.id, {
        totalRecipients: smsCustomers.length,
        status: "sending",
      });

      // Send to each customer (async, but we track results)
      let successCount = 0;
      let failCount = 0;

      for (const customer of smsCustomers) {
        try {
          // Format phone number
          const cleanDigits = customer.phone.replace(/\D/g, '');
          let formattedPhone: string;
          if (cleanDigits.length === 10) {
            formattedPhone = '+1' + cleanDigits;
          } else if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) {
            formattedPhone = '+' + cleanDigits;
          } else {
            throw new Error(`Invalid phone format: ${customer.phone}`);
          }

          if (telnyxConfigured) {
            // Send SMS using the REST API
            const result = await sendTelnyxSMS(telnyxPhoneNumber!, formattedPhone, messageText);
            // Record successful send with external message ID
            await storage.createAnnouncementRecipient({
              announcementId: announcement.id,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: formattedPhone,
              status: "sent",
              externalMessageId: result.id,
            });
            console.log(`✅ Announcement sent to ${customer.name} (${formattedPhone})`);
          } else {
            // Log-only mode when Telnyx not configured
            await storage.createAnnouncementRecipient({
              announcementId: announcement.id,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: formattedPhone,
              status: "logged",
            });
            console.log(`📝 [LOG ONLY] Would send announcement to ${customer.name} (${formattedPhone}): "${messageText.substring(0, 50)}..."`);
          }
          successCount++;
        } catch (error: any) {
          // Record failed send
          await storage.createAnnouncementRecipient({
            announcementId: announcement.id,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            status: "failed",
            errorMessage: error.message,
          });
          failCount++;
          console.error(`❌ Failed to send to ${customer.name}: ${error.message}`);
        }
      }

      // Update announcement with final counts
      const finalAnnouncement = await storage.updateAnnouncement(announcement.id, {
        successfulSends: successCount,
        failedSends: failCount,
        status: "completed",
        completedAt: new Date(),
      });

      const modeMessage = telnyxConfigured ? "sent" : "logged (SMS not configured)";
      res.json({
        ...finalAnnouncement,
        message: `Announcement ${modeMessage} to ${successCount} customers. ${failCount} failed.`,
      });
    } catch (error) {
      console.error("Send announcement error:", error);
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
